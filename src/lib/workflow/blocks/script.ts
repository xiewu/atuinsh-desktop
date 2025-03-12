import { DependencySpec } from "../dependency";
import Block from "./block";

export class ScriptBlock extends Block {
  code: string;
  interpreter: string;
  outputVariable: string;
  outputVisible: boolean;

  get typeName() {
    return "script";
  }


  constructor(
    id: string,
    name: string,
    dependency: DependencySpec,
    code: string,
    interpreter: string,
    outputVariable: string,
    outputVisible: boolean,
  ) {
    super(id, name, dependency);

    this.code = code;
    this.interpreter = interpreter;
    this.outputVariable = outputVariable;
    this.outputVisible = outputVisible;
  }

  object() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      interpreter: this.interpreter,
      outputVariable: this.outputVariable,
      outputVisible: this.outputVisible,
    };
  }

  serialize() {
    return JSON.stringify(this.object());
  }

  static deserialize(json: string) {
    const data = JSON.parse(json);
    return new ScriptBlock(
      data.id,
      data.name,
      data.dependency,
      data.code,
      data.interpreter,
      data.outputVariable,
      data.outputVisible,
    );
  }
}
