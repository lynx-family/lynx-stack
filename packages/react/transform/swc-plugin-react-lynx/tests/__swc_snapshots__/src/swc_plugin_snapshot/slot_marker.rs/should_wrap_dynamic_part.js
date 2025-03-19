<view/>; // should not handle top-level JSXElement
<A/>; // should not handle top-level JSXElement
<A><view></view></A>;
<internal-slot><view><A/></view></internal-slot>; // children is full dynamic
<internal-slot><view><A/><A/></view></internal-slot>; // children is full dynamic
<view><internal-slot><wrapper><A/></wrapper></internal-slot><text/><internal-slot><wrapper><A/></wrapper></internal-slot></view>; // <A/> should be wrapped inside wrapper
<internal-slot><view>{1}</view></internal-slot>;
<internal-slot><view>{1}{2}</view></internal-slot>;
<view><internal-slot><wrapper>{1}</wrapper></internal-slot>2</view>;
<internal-slot><list>{[
    <list-item/>,
    <list-item/>
]}</list></internal-slot>;
<internal-slot><list>{[
    <list-item><A/>A</list-item>,
    <list-item/>
]}</list></internal-slot>;
<internal-slot><view>{<view><A/><text/><A/></view>}</view></internal-slot>;
<view><internal-slot><list>{[
    <list-item/>,
    <list-item/>
]}</list></internal-slot>a<internal-slot><view><A/></view></internal-slot></view>;
