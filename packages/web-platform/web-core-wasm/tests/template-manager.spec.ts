// import { describe, test, expect } from 'vitest';
// import { templateManager } from '../ts/createMtsGlobalThis.js';

// describe.only('TemplateManager_json', () => {
//   test('empty json-throw', () => {
//     expect(() => {
//       templateManager.push_json_template_to_cache('test', {});
//     }).toThrow();
//   });
//   test('empty json-minimal', () => {
//     templateManager.push_json_template_to_cache('test', {
//       lepusCode: {
//         root: '',
//       },
//       manifest: {},
//       pageConfig: {},
//       styleInfo: {},
//     });
//   });

//   test('lepusCode has object property', () => {
//     templateManager.push_json_template_to_cache('test', {
//       lepusCode: {
//         root: '',
//         some_obj: {},
//       },
//       manifest: {},
//       pageConfig: {},
//       styleInfo: {},
//     });
//   });

//   test('styleinfo', () => {
//     templateManager.push_json_template_to_cache('test', {
//       lepusCode: {
//         root: '',
//       },
//       manifest: {},
//       pageConfig: {},
//       styleInfo: {
//         '0': {
//           'content': [''],
//           'rules': [{
//             'sel': [[['.background-green'], [], [], []]],
//             'decl': [['background-color', 'green']],
//           }, {
//             'sel': [[['.background-yellow'], [], [], []]],
//             'decl': [['background-color', '#ff0']],
//           }],
//         },
//       },
//     });
//   });
// });
