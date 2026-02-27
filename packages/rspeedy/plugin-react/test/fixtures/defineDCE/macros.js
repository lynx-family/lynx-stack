if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
  profileStart('test')
}

const config = (typeof __PROFILE__ !== 'undefined' && __PROFILE__)
  ? 'profile-mode'
  : 'profile-off-mode'

console.info(`Config is: ${config}`)
