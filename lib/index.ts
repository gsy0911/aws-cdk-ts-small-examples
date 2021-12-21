export {SqsLambda} from './SqsLambda';
export {
	EcsFargateStack,
	EcrEcsFargateStack, IEcrEcsFargateStack,
	EcrEcsMultipleFargateElbStack1,
	EcrEcsMultipleFargateElbStack2,
	EcrEcsSingleFargateElbStack,
	EcrEcsMultipleServicesFargateElbStack
} from './EcrEcsFargateStack';
export {BatchSfnStack, IBatchSfnStack} from './BatchLogSfnStack';
export {VpcRdsStack, RdsEc2AccessStack, RdsEc2IamAccessStack} from './VpcRdsStack';

// env
export interface IEnv {
    /** 12 digits */
    account: string
    /** aws region */
    region: "ap-northeast-1"
}
