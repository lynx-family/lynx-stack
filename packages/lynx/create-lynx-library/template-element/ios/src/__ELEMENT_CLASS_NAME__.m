#import "__ELEMENT_CLASS_NAME__.h"

@LynxUIRegister("__ELEMENT_NAME__")
@implementation __ELEMENT_CLASS_NAME__

- (UILabel *)createView {
  UILabel *label = [[UILabel alloc] init];
  label.text = @"__ELEMENT_NAME__";
  return label;
}

@end
