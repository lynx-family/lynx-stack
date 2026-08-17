function Deferred({ children }) {
    return __MAIN_THREAD__ ? <A/> : <><B>{children}</B></>;
}
