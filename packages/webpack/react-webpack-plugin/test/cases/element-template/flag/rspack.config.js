import { createConfig } from '../../../create-react-config.js';

export default {
  context: __dirname,
  ...createConfig(
    {},
    { experimental_enableElementTemplate: true },
  ),
};
