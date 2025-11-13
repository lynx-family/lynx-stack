import {
  LynxElement,
  MainThreadGlobalThis,
  TemplateManager,
} from '../dist/debug.js';
import type { MainThreadGlobalThis as IMainThreadGlobalThis } from '@lynx-js/web-constants';

export const templateManager = new TemplateManager();
export function createMtsGlobalThis(
  ...args: ConstructorParameters<typeof MainThreadGlobalThis>
): IMainThreadGlobalThis {
  const mtsGlobalThis = new MainThreadGlobalThis(...args);
  return {
    // __ElementFromBinary: mtsGlobalThis.__ElementFromBinary.bind(
    //   mtsGlobalThis,
    // ),
    __GetTemplateParts: mtsGlobalThis.__GetTemplateParts.bind(mtsGlobalThis),
    __MarkTemplateElement: mtsGlobalThis.__MarkTemplateElement.bind(
      mtsGlobalThis,
    ),
    __MarkPartElement: mtsGlobalThis.__MarkPartElement.bind(mtsGlobalThis),
    __AddEvent: mtsGlobalThis.__AddEvent.bind(mtsGlobalThis),
    __GetEvent: mtsGlobalThis.__GetEvent.bind(mtsGlobalThis),
    __GetEvents: mtsGlobalThis.__GetEvents.bind(mtsGlobalThis),
    __SetEvents: mtsGlobalThis.__SetEvents.bind(mtsGlobalThis),
    __AppendElement: mtsGlobalThis.__AppendElement.bind(mtsGlobalThis),
    __ElementIsEqual: (a, b) => {
      if (a instanceof LynxElement && b instanceof LynxElement) {
        return mtsGlobalThis.__wasm_binding_ElementIsEqual(a, b);
      }
      return false;
    },
    __FirstElement: mtsGlobalThis.__FirstElement.bind(mtsGlobalThis),
    __GetChildren: mtsGlobalThis.__GetChildren.bind(mtsGlobalThis),
    __GetParent: mtsGlobalThis.__GetParent.bind(mtsGlobalThis),
    __InsertElementBefore: mtsGlobalThis.__InsertElementBefore.bind(
      mtsGlobalThis,
    ),
    __LastElement: mtsGlobalThis.__LastElement.bind(mtsGlobalThis),
    __NextElement: mtsGlobalThis.__NextElement.bind(mtsGlobalThis),
    __RemoveElement: mtsGlobalThis.__RemoveElement.bind(mtsGlobalThis),
    __ReplaceElement: mtsGlobalThis.__ReplaceElement.bind(mtsGlobalThis),
    __ReplaceElements: mtsGlobalThis.__ReplaceElements.bind(mtsGlobalThis),
    __AddConfig: mtsGlobalThis.__AddConfig.bind(mtsGlobalThis),
    __AddDataset: mtsGlobalThis.__AddDataset.bind(mtsGlobalThis),
    __GetAttributes: mtsGlobalThis.__GetAttributes.bind(mtsGlobalThis),
    __GetComponentID: mtsGlobalThis.__GetComponentID.bind(mtsGlobalThis),
    __GetDataByKey: mtsGlobalThis.__GetDataByKey.bind(mtsGlobalThis),
    __GetDataset: mtsGlobalThis.__GetDataset.bind(mtsGlobalThis),
    __GetElementConfig: mtsGlobalThis.__GetElementConfig.bind(mtsGlobalThis),
    __GetElementUniqueID: (element: unknown) => {
      if (element instanceof LynxElement) {
        return mtsGlobalThis.__wasm_binding__GetElementUniqueID(element);
      }
      return -1;
    },
    __GetID: mtsGlobalThis.__GetID.bind(mtsGlobalThis),
    __GetTag: mtsGlobalThis.__GetTag.bind(mtsGlobalThis),
    __SetConfig: mtsGlobalThis.__SetConfig.bind(mtsGlobalThis),
    __SetDataset: mtsGlobalThis.__SetDataset.bind(mtsGlobalThis),
    __SetID: mtsGlobalThis.__SetID.bind(mtsGlobalThis),
    __UpdateComponentID: mtsGlobalThis.__UpdateComponentID.bind(
      mtsGlobalThis,
    ),
    __UpdateComponentInfo: mtsGlobalThis.__UpdateComponentInfo.bind(
      mtsGlobalThis,
    ),
    __CreateElement: mtsGlobalThis.__CreateElement.bind(mtsGlobalThis),
    __CreateView: mtsGlobalThis.__CreateView.bind(mtsGlobalThis),
    __CreateText: mtsGlobalThis.__CreateText.bind(mtsGlobalThis),
    __CreateComponent: mtsGlobalThis.__CreateComponent.bind(mtsGlobalThis),
    __CreatePage: mtsGlobalThis.__CreatePage.bind(mtsGlobalThis),
    __CreateRawText: mtsGlobalThis.__CreateRawText.bind(mtsGlobalThis),
    __CreateImage: mtsGlobalThis.__CreateImage.bind(mtsGlobalThis),
    __CreateScrollView: mtsGlobalThis.__CreateScrollView.bind(mtsGlobalThis),
    __CreateWrapperElement: mtsGlobalThis.__CreateWrapperElement.bind(
      mtsGlobalThis,
    ),
    __CreateList: mtsGlobalThis.__CreateList.bind(mtsGlobalThis),
    __SetAttribute: mtsGlobalThis.__SetAttribute.bind(mtsGlobalThis),
    __SwapElement: mtsGlobalThis.__SwapElement.bind(mtsGlobalThis),
    __UpdateListCallbacks: mtsGlobalThis.__UpdateListCallbacks.bind(
      mtsGlobalThis,
    ),
    __GetConfig: mtsGlobalThis.__GetConfig.bind(mtsGlobalThis),
    __GetAttributeByName: mtsGlobalThis.__GetAttributeByName.bind(
      mtsGlobalThis,
    ),
    __GetClasses: mtsGlobalThis.__GetClasses.bind(mtsGlobalThis),
    __AddClass: mtsGlobalThis.__AddClass.bind(mtsGlobalThis),
    __SetClasses: mtsGlobalThis.__SetClasses.bind(mtsGlobalThis),
    __AddInlineStyle: (
      element: LynxElement,
      key: string | number,
      value: string | number | null | undefined,
    ) => {
      if (typeof value === 'number') {
        value = (value as number).toString();
      }
      if (typeof key === 'number') {
        return mtsGlobalThis.__wasm_binding_AddInlineStyle_number_key(
          element,
          key,
          value as string | null,
        );
      } else {
        return mtsGlobalThis.__wasm_binding_AddInlineStyle_str_key(
          element,
          key.toString(),
          value as string | null,
        );
      }
    },
    __SetCSSId: mtsGlobalThis.__SetCSSId.bind(mtsGlobalThis),
    __SetInlineStyles: (
      element: LynxElement,
      value: string | Record<string, string | number> | undefined,
    ) => {
      if (typeof value === 'string') {
        return mtsGlobalThis.__wasm_binding_SetInlineStyles(
          element,
          value,
        );
      } else {
        // Clear all inline styles
        mtsGlobalThis.__wasm_binding_SetInlineStyles(
          element,
          '',
        );
        if (value) {
          for (const [key, val] of Object.entries(value)) {
            if (val !== null) {
              mtsGlobalThis.__wasm_binding_AddInlineStyle_str_key(
                element,
                key,
                val.toString(),
              );
            }
          }
        }
      }
    },
    __FlushElementTree: mtsGlobalThis.__FlushElementTree.bind(mtsGlobalThis),
    // __LoadLepusChunk: mtsGlobalThis.__LoadLepusChunk.bind(mtsGlobalThis),
    __GetPageElement: mtsGlobalThis.__GetPageElement.bind(mtsGlobalThis),
    __QueryComponent: (
      url,
      resultCallback,
    ) => {
      try {
        const result = mtsGlobalThis.__wasm_binding_queryComponent(
          url,
          templateManager,
        );
        resultCallback?.({
          code: 0,
          data: {
            url,
            evalResult: result,
          },
        });
      } catch (e) {
        console.error(`lynx web: lazy bundle load failed:`, e);
        resultCallback?.({
          code: -1,
          data: undefined,
        });
      }
      return null;
    },
  };
}
