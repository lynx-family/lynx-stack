# Image fixtures

These four PNGs are 64 × 64 pixels with 8-bit RGBA channels and solid opaque
red, blue, green, or yellow pixels. The ZIP capture test loads them through the
native Lynx renderer to check resource resolution and isolation between uploads.
The comparison tests use `red.png` to verify that non-BMP uploads are rejected.

Keep these fixtures as static bytes. UI Judge only needs the BMP codec for its
screenshot and comparison APIs; its tests must not enable a PNG codec dependency.
