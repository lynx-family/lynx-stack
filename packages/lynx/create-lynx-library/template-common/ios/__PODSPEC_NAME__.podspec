Pod::Spec.new do |s|
  s.name = '__PODSPEC_NAME__'
  s.version = '0.0.1'
  s.summary = 'Native Lynx library'
  s.homepage = 'https://github.com/lynx-family/lynx'
  s.license = { :type => 'Apache-2.0' }
  s.author = 'Lynx'
  s.source = { :path => '..' }
  s.source_files = 'src/**/*.{h,m,mm}'
  s.dependency 'Lynx'
__IOS_SERVICE_API_DEPENDENCY__
__IOS_NAPI_ADDON_PODSPEC__
end
