#!/bin/sh
# Run in the regctl Alpine image, after buildkit-custom has pushed its temporary tag.
set +x
set -eu
set -f

image_repo=${1:?registry repository is required}
temporary_tag=${2:?temporary tag is required}
commit_sha=${3:?commit SHA is required}
: "${CR_USERNAME:?CR_USERNAME is required}"
: "${CR_PASSWORD:?CR_PASSWORD is required}"
case "$commit_sha" in ''|*[!0-9a-f]*) exit 1 ;; esac
test "${#commit_sha}" -eq 40
case "$temporary_tag" in build-*) ;; *) exit 1 ;; esac

work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export REGCTL_CONFIG="$work_dir/config.json"
printf '%s' "$CR_PASSWORD" | regctl registry login "${image_repo%%/*}" \
  --user "$CR_USERNAME" --pass-stdin
unset CR_PASSWORD

# Read errors must fail the step, not be treated as an absent commit tag.
regctl tag ls "$image_repo" > "$work_dir/tags"
temporary_digest=$(regctl image digest "$image_repo:$temporary_tag")
if grep -Fxq "$commit_sha" "$work_dir/tags"; then
  echo "Keeping the previously published image for $commit_sha"
  image_digest=$(regctl image digest "$image_repo:$commit_sha")
else
  image_digest=$temporary_digest
  regctl image copy "$image_repo@$image_digest" "$image_repo:$commit_sha"
fi
test "$(regctl image digest "$image_repo:$commit_sha")" = "$image_digest"

# Inventory every tag before deleting anything. Unknown tags remain protected,
# including aliases for deployed versions and BuildKit cache tags.
regctl tag ls "$image_repo" > "$work_dir/tags"
: > "$work_dir/inventory"
: > "$work_dir/commits"
: > "$work_dir/keep"
printf '%s\n' "$commit_sha" >> "$work_dir/keep"
for protected in ${CR_PROTECTED_COMMITS:-}; do
  case "$protected" in ''|*[!0-9a-f]*) echo 'Invalid protected commit' >&2; exit 1 ;; esac
  test "${#protected}" -eq 40
  printf '%s\n' "$protected" >> "$work_dir/keep"
done
cutoff=$(($(date +%s) - 86400))
while IFS= read -r tag; do
  digest=$(regctl image digest "$image_repo:$tag")
  printf '%s %s\n' "$tag" "$digest" >> "$work_dir/inventory"
  if [ "$tag" = "$temporary_tag" ]; then
    continue
  fi
  case "$tag" in
    build-*) kind=temporary ;;
    *[!0-9a-f]*) kind=protected ;;
    *)
      if [ "${#tag}" -eq 40 ]; then kind=commit; else kind=protected; fi
      ;;
  esac
  if [ "$kind" = protected ]; then
    printf '%s\n' "$tag" >> "$work_dir/keep"
    continue
  fi
  created=$(regctl image inspect "$image_repo@$digest" --platform linux/amd64 \
    --format '{{.Created.Unix}}')
  case "$created" in ''|*[!0-9]*) echo "Missing creation time for $tag" >&2; exit 1 ;; esac
  test "$created" -gt 0
  if [ "$kind" = commit ]; then
    printf '%s %s\n' "$created" "$tag" >> "$work_dir/commits"
  elif [ "$created" -gt "$cutoff" ]; then
    # Do not interfere with another run (the CP task timeout is two hours).
    printf '%s\n' "$tag" >> "$work_dir/keep"
  fi
done < "$work_dir/tags"

# Image creation time, not lexical SHA order, determines the newest ten builds.
sort -k1,1nr -k2,2 "$work_dir/commits" > "$work_dir/sorted-commits"
awk 'NR <= 10 {print $2}' "$work_dir/sorted-commits" >> "$work_dir/keep"
awk 'NR == FNR {keep[$1]=1; next} $1 in keep {print $2}' \
  "$work_dir/keep" "$work_dir/inventory" > "$work_dir/root-digests"
sort -u "$work_dir/root-digests" > "$work_dir/keep-digests"
# A retained index may reference a manifest that also has an obsolete SHA tag.
# Protect its descendants as well, without traversing configuration or layer blobs.
cp "$work_dir/keep-digests" "$work_dir/pending"
: > "$work_dir/visited"
while test -s "$work_dir/pending"; do
  : > "$work_dir/next"
  while IFS= read -r digest; do
    if grep -Fxq "$digest" "$work_dir/visited"; then continue; fi
    regctl manifest get "$image_repo@$digest" \
      --format '{{if .IsList}}{{range .GetManifestList}}{{println .MediaType .Digest}}{{end}}{{end}}' \
      > "$work_dir/children"
    printf '%s\n' "$digest" >> "$work_dir/visited"
    while read -r media_type child; do
      case "$media_type" in
        application/vnd.oci.image.manifest.v1+json|application/vnd.oci.image.index.v1+json|application/vnd.docker.distribution.manifest.v2+json|application/vnd.docker.distribution.manifest.list.v2+json)
          printf '%s\n' "$child" >> "$work_dir/keep-digests"
          printf '%s\n' "$child" >> "$work_dir/next"
          ;;
      esac
    done < "$work_dir/children"
  done < "$work_dir/pending"
  sort -u "$work_dir/next" > "$work_dir/pending"
done
awk 'NR == FNR {keep[$1]=1; next} !($1 in keep)' \
  "$work_dir/keep" "$work_dir/inventory" > "$work_dir/delete"
: > "$work_dir/deleted-digests"

# Catch overlapping publications before applying the inventory. The CP
# concurrency lock is still required to serialize publication and cleanup.
regctl tag ls "$image_repo" > "$work_dir/current-tags"
if ! cmp -s "$work_dir/tags" "$work_dir/current-tags"; then
  echo 'Repository tags changed during inventory; serialize publishers before retrying' >&2
  exit 1
fi

while read -r tag digest; do
  if grep -Fxq "$digest" "$work_dir/deleted-digests"; then continue; fi
  if grep -Fxq "$digest" "$work_dir/keep-digests"; then
    # Retain commit tags that alias a protected digest, so SHA-based deployments
    # can still restart even if protection was configured via another tag.
    case "$tag" in build-*) ;; *) echo "Keeping shared image $tag"; continue ;; esac
    echo "Deleting temporary tag $tag"
    regctl tag delete "$image_repo:$tag"
  else
    # Delete unreferenced manifests, not just tags, so registry GC can reclaim
    # their unused layers. Never delete blobs or recursively delete child images.
    echo "Deleting obsolete image $tag ($digest)"
    regctl image delete "$image_repo@$digest"
    printf '%s\n' "$digest" >> "$work_dir/deleted-digests"
  fi
done < "$work_dir/delete"

test "$(regctl image digest "$image_repo:$commit_sha")" = "$image_digest"
echo "Published image: $image_repo:$commit_sha"
echo "Image digest: $image_digest"
