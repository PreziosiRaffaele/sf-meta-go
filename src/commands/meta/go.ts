import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-meta-go', 'meta.go');

export type MetaGoResult = {
  path: string;
};

export default class MetaGo extends SfCommand<MetaGoResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.file,
  };

  public async run(): Promise<MetaGoResult> {
    const { flags } = await this.parse(MetaGo);

    const name = flags.name ?? 'world';
    this.log(`hello ${name} from /Users/raffaele.preziosi/VsCode/sf-meta-go/sf-meta-go/src/commands/meta/go.ts`);
    return {
      path: '/Users/raffaele.preziosi/VsCode/sf-meta-go/sf-meta-go/src/commands/meta/go.ts',
    };
  }
}
