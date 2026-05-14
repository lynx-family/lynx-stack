package __ANDROID_PACKAGE__;

import android.content.Context;
import android.widget.TextView;
import com.lynx.tasm.behavior.LynxAutolinkElement;
import com.lynx.tasm.behavior.LynxContext;
import com.lynx.tasm.behavior.ui.LynxUI;

@LynxAutolinkElement(name = "__ELEMENT_NAME__")
public class __ELEMENT_CLASS_NAME__ extends LynxUI<TextView> {
  public __ELEMENT_CLASS_NAME__(LynxContext context) {
    super(context);
  }

  @Override
  protected TextView createView(Context context) {
    TextView view = new TextView(context);
    view.setText("__ELEMENT_NAME__");
    return view;
  }
}
