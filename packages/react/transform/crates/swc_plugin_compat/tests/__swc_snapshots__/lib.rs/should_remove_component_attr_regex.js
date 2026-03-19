let c = 1;
const a1 = <A/>;
const a2 = <A.B/>;
// FIXME: the `is_component` check is align with previous version of ReactLynx for compat reason
const a3 = <__a bindtap={this.handleClick} handleTap={this.handleClick}/>;
const a4 = <A {...x}/>;
const b = <view bindtap={this.handleClick} handleTap={this.handleClick}/>;
a1, a2, a3, a4, b;
