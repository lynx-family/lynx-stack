package __ANDROID_PACKAGE__;

import androidx.annotation.Nullable;
import com.lynx.jsbridge.LynxAutolinkNativeModule;
import com.lynx.jsbridge.LynxMethod;
import com.lynx.tasm.behavior.LynxContext;
import __ANDROID_PACKAGE__.generated.__MODULE_NAME__Spec;

@LynxAutolinkNativeModule(name = "__MODULE_NAME__")
public class __MODULE_NAME__ extends __MODULE_NAME__Spec {
  public __MODULE_NAME__(LynxContext context) {
    super(context);
  }

  @Override
  @LynxMethod
  public void setValue(String key, String value) {
  }

  @Override
  @LynxMethod
  @Nullable
  public String getValue(String key) {
    return null;
  }

  @Override
  @LynxMethod
  public void clear() {
  }
}
