/*@jsxCSSId 1694742*/ import './foo.css';
import styles from "./bar.css?cssId=1694742";
import * as styles2 from "@fancy-ui/main.css?cssId=1694742";
import { clsA, clsB } from "./baz.module.css?cssId=1694742";
const jsx = <view className={`foo ${styles.bar} ${styles2.baz} ${clsA} ${clsB}`}/>;
