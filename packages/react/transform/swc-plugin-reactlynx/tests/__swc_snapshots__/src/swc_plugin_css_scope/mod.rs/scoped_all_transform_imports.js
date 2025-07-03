/*@jsxCSSId 1185352*/ import "./foo.css?cssId=1185352";
import styles from "./bar.css?cssId=1185352";
import * as styles2 from "@fancy-ui/main.css?cssId=1185352";
import { clsA, clsB } from "./baz.module.css?cssId=1185352";
const jsx = <view className={`foo ${styles.bar} ${styles2.baz} ${clsA} ${clsB}`}/>;
