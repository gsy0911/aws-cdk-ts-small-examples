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

// env
export interface IEnv {
    /** 12 digits */
    account: string
    /** aws region */
    region: "ap-northeast-1"
}
