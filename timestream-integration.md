steps taken to integrate timestream into iot-center-v2

  - search for timestream, found official docs
  - directly go to code samples [write data](https://docs.aws.amazon.com/timestream/latest/developerguide/code-samples.write.html)
    - docs doesn't contain any reference for required code dependencies *(imports/secrets)*. User has to go through previous code samples to know what import (not practical when I want only write but I don't care about previous docs)
  - secrets setup is't straight forward. It takes some time to know how create secret.
  - credentials can be passed into application by code directly, by environment value or by shared config file ([this](https://stackoverflow.com/questions/61028751/missing-credentials-in-config-if-using-aws-config-file-set-aws-sdk-load-config) helped)
    - first test using incode credentials working good but isn't much practical
    - there was a problem when quering when using environment values. Probably caused by using wrong envirnment value for region. Main problem was that this misused envirnment value caused query to throw `Requested database 'iot_center_v2' not found for identifier 'iot_center_v2.Table1'` error which looks like there's something wrong with query but it isn't.
    - Query and write works just fine when using global file for credentials (.aws dir)
  - [Example code (.js)](https://github.com/awslabs/amazon-timestream-tools/tree/mainline/sample_apps/js) looks good and contain's everything
  - Queries returns specific format which contains types and has no direct function to transform into typeless JSON 
  - All queries are implicitly paginated
  - Writing small batch of datapoints (about 15) can cause write do throw error `Member must have length less than or equal to 100`
