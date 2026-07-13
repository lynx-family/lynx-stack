export default ({ env, command }) => {
  return {
    source: {
      entry: `env-${env}|command-${command}`,
    },
  }
}
