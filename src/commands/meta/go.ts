import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Connection } from '@salesforce/core';
import { go } from '../../OpenMetadataHandler.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-meta-go', 'meta.go');

export type MetaGoResult = {
  isSuccess: boolean;
  error?: string;
};

export default class MetaGo extends SfCommand<MetaGoResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    metadata: Flags.file({
      summary: messages.getMessage('flags.metadata.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
    targetusername: Flags.requiredOrg({
      summary: messages.getMessage('flags.targetusername.summary'),
      char: 'o',
      required: true,
    }),
  };

  public async run(): Promise<MetaGoResult> {
    const { flags } = await this.parse(MetaGo);

    try {
      const conn: Connection = flags.targetusername.getConnection();
      await go(conn, flags.metadata);
      return {
        isSuccess: true,
      };
    } catch (exception) {
      const err = exception instanceof Error ? exception.message : String(exception);
      this.log(`Error to open Metadata: ${err}`);
      return {
        isSuccess: false,
        error: err,
      };
    }
  }
}
