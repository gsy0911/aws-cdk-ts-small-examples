export {SqsLambda} from './SqsLambda';
export {
	EcrEcsFargateStack, IEcrEcsFargateStack,
	EcrEcsMultipleFargateElbStack1,
	EcrEcsMultipleFargateElbStack2
} from './EcrEcsFargateStack';
export {BatchSfnStack, IBatchSfnStack} from './BatchLogSfnStack';

// env
export interface IEnv {
    /** 12 digits */
    account: string
    /** aws region */
    region: "ap-northeast-1"
}
