#import <Foundation/Foundation.h>
#import <LynxServiceAPI/ServiceAPI.h>

NS_ASSUME_NONNULL_BEGIN

@protocol __SERVICE_PROTOCOL_NAME__ <LynxServiceProtocol>

- (NSString *)name;

@end

@interface __SERVICE_NAME__ : NSObject <__SERVICE_PROTOCOL_NAME__>

@end

NS_ASSUME_NONNULL_END
