import { root, Component } from '@lynx-js/react';
import ResultCell from './mini-result-cell/index.jsx';
import Outer from './outer.jsx';
const forSelect = {
  s00_id: ['#view-card', 'view-card'],
  s01_class: ['.class-1', 'view-card-1'],
  s02_class_2: ['.class-1.class-2', 'view-card-2'],
  s03_child_1: ['#view-card>#view-card-1', 'view-card-1'],
  s04_child_2: ['  .class-view   >   #view-card-1   ', 'view-card-1'],
  s05_child_fail_1: ['  #outer-card-2   >   #root-outer   ', null],
  s06_descendant: ['.root #view-card-1', 'view-card-1'],
  s07_descendant_fail_1: ['  #outer-card-2    #root-outer   ', null],
  s08_descendant_fail_2: ['  .root    #root-outer   ', null],
  // s09_descendant_cross_components_1: [".root >>> #root-outer", "root-outer"],
  // s10_descendant_cross_components_2: [".root >>> #root-inner", "root-inner"],

  s11_fixed_1: ['#view-card> #view-card-fixed', 'view-card-fixed'],
  s12_slot_1: ['#outer-card-2> #view-slot', 'view-slot'],
  s13_slot_2: ['.root #view-slot', 'view-slot'],
  s14_slot_3: ['#outer-card-1>#outer-card-2>#view-slot', 'view-slot'],
  s15_component: ['#outer-card-1', 'root-outer'],

  // s16_chain_1: [" .root >>> #inner-outer #view-slot-outer", "view-slot-outer"],
  s17_tag: ['text', 'text-card'],
  // s18_tag_page_recursive: ["page >>> #view-inner", "view-inner"],

  s19_attr: ['[ax-label]', 'view-card-2'],
  s20_attr_fail: ['[ax-label-1]', null],
  s21_attr_value: ['[ax-label=test_value]', 'view-card-2'],
  s22_attr_value_fail: ['[ax-label=test_value_1]', null],
  s23_attr_value_bool: ['[ax-bool=true]', 'view-card-2'],
  s24_dataset: ['[data-test]', 'view-card-2'],
  s25_dataset_value: ['[data-test=test_value]', 'view-card-2'],
  s26_dataset_value_null: ['[data-test=test_value_1]', null],
  // s27_attr_empty: ["[]", null],
  s28_dataset_comp: ['[data-comp=comp]', 'root-outer'],

  s29_attr_chain_1: ['.outer-class[data-comp] .class-1', 'view-slot'],
  s30_attr_chain_2: ['#outer-card-1[data-comp] .class-1', null],
  // s31_slot_chain: [
  //   '.root #outer-card-1 > #outer-card-2 >>> #inner-outer > #view-slot-outer',
  //   'view-slot-outer',
  // ],
};
class App extends Component {
  constructor(props) {
    super(props);
    this.state = { result: [] };
  }

  componentDidMount() {
    Object.keys(forSelect).forEach((item) => {
      lynx.createSelectorQuery()
        .select(forSelect[item][0])
        .invoke({
          method: 'boundingClientRect',
          success: (res) => {
            this.checkSuccess(item, res);
          },
          fail: (res) => {
            this.checkFailed(item, res);
          },
        })
        .exec();
    });
  }

  checkSuccess(testKey, returnValue) {
    const match = returnValue.id === forSelect[testKey][1];
    this.logTestCaseIfNotMatch(testKey, match, returnValue);
    const result = {
      result: match,
      desc: testKey,
    };
    this.setState({
      result: [...this.state.result, result],
    });
  }

  checkFailed(testKey, returnValue) {
    const match = null === forSelect[testKey][1];
    this.logTestCaseIfNotMatch(testKey, match, returnValue);
    const result = {
      result: match,
      desc: testKey,
    };
    this.setState({
      result: [...this.state.result, result],
    });
  }

  logTestCaseIfNotMatch(testKey, match, returnValue) {
    if (!match) {
      console.log(
        'testKey:',
        testKey,
        'returnValue:',
        JSON.stringify(returnValue),
      );
    }
  }
  render() {
    return (
      <scroll-view
        class='root'
        lynx-test-tag='scroll-view'
        scroll-y
        flatten='false'
      >
        {this.state.result?.map((item, idx) => (
          <ResultCell
            result={item.result}
            desc={item.desc}
            idx={idx}
          />
        ))}

        <view>
          <view id='view-card' class='class-view'>
            <view id='view-card-1' class='class-1'></view>
            <view
              id='view-card-2'
              class='class-1 class-2'
              ax-label='test_value'
              ax-bool={true}
              data-test='test_value'
            >
            </view>
            <view id='view-card-fixed' style='position:fixed'></view>
            <text id='text-card' data-hi='hihi'></text>
          </view>
          <Outer id='outer-card-1' class='outer-class'>
            <Outer
              id='outer-card-2'
              class='outer-class'
              ax-comp='comp'
              data-comp='comp'
            >
              <view id='view-slot' class='class-1'>
                {' '}
              </view>
            </Outer>
          </Outer>
          <view id='view'></view>
        </view>
      </scroll-view>
    );
  }
}

root.render(
  <page>
    <App removeComponentElement={true} />
  </page>,
);
