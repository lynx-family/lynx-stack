#import "__MODULE_NAME__.h"

@implementation __MODULE_NAME__

+ (NSString *)name {
  return @"__MODULE_NAME__";
}

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{
    @"setValue" : NSStringFromSelector(@selector(setValue:value:)),
    @"getValue" : NSStringFromSelector(@selector(getValue:)),
    @"clear" : NSStringFromSelector(@selector(clear)),
  };
}

- (void)setValue:(NSString *)key value:(NSString *)value {
}

- (nullable NSString *)getValue:(NSString *)key {
  return nil;
}

- (void)clear {
}

@end
