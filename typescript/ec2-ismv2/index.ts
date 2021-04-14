import * as cdk from "@aws-cdk/core";
import {Ec2Imdsv2Stack} from './Ec2Imdsv2Stack';
import {IParameters} from './IParameters';
import {params} from './params';


const app = new cdk.App();
new Ec2Imdsv2Stack(app, "Ec2Ismv2", params, {description: "ts-example"});
app.synth();
