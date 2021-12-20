export {SqsLambda} from './SqsLambda';
export {EcrEcsFargateStack, IEcrEcsFargateStack} from './EcrEcsFargateStack';

// env
export interface IEnv {
    /** 12 digits */
    account: string
    /** aws region */
    region: "ap-northeast-1"
}
