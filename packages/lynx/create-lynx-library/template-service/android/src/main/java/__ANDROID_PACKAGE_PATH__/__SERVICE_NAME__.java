package __ANDROID_PACKAGE__;

import com.lynx.tasm.service.IServiceProvider;
import com.lynx.tasm.service.LynxService;

@LynxService
public class __SERVICE_NAME__ implements IServiceProvider {
  @Override
  public Class<? extends IServiceProvider> getServiceClass() {
    return __SERVICE_NAME__.class;
  }

  public String name() {
    return "__SERVICE_NAME__";
  }
}
