staging_bucket=$(aws cloudformation describe-stack-resources --stack-name CDKToolkit --logical-resource-id StagingBucket --query 'StackResources[].PhysicalResourceId' --output=text)
for asset in $(ls cdk.out | grep asset); do
  hash=$(echo ${asset} | cut -d'.' -f2)
  aws s3 rm s3://${staging_bucket}/assets/${hash}.zip
done
