import { createConfig } from '../../../create-react-config.js';

export default {
  context: import.meta.dirname,
  ...createConfig(
    {},
    { experimental_useElementTemplate: true },
  ),
};
