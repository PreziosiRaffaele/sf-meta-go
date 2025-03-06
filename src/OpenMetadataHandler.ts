/* eslint-disable class-methods-use-this */
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Connection } from '@salesforce/core';
import { isStandardField, getObjectFieldDeveloperName, isCustomMetadata, isPlatformEvent, isWindows } from './Utils.js';

const execPromise = promisify(exec);

// Helper function to get object ID using tooling API
async function getObjectId(conn: Connection, objectName: string): Promise<string> {
  const records = await conn.tooling
    .sobject('CustomObject')
    .find({ DeveloperName: getObjectFieldDeveloperName(objectName) })
    .execute();

  if (records.length === 0) {
    throw new Error(`Object not found for ${objectName}`);
  }
  return records[0].Id as string;
}

export async function go(conn: Connection, pathString: string): Promise<void> {
  const pathParsed = path.parse(pathString);
  const extension = getExtension(pathParsed.base);
  const metadata = new Factory().create(conn, extension, pathParsed);
  const url = await metadata.getUrl();
  const completeUrl = `${conn.instanceUrl}/${url}`;
  if (isWindows()) {
    await execPromise(`start ${completeUrl}`);
  } else {
    await execPromise(`open ${completeUrl}`);
  }
}

function getExtension(pathParsedBase: string): string {
  const fileNameSplitted = pathParsedBase.split('.');

  if (fileNameSplitted.length > 2) {
    return `${fileNameSplitted[fileNameSplitted.length - 2]}.${fileNameSplitted[fileNameSplitted.length - 1]}`;
  } else {
    return fileNameSplitted[fileNameSplitted.length - 1];
  }
}

class Factory {
  public create = (conn: Connection, extension: string, pathParsed: path.ParsedPath): Metadata => {
    if (!conn || !extension || !pathParsed) {
      throw new Error('Invalid parameters');
    }
    let metadata: Metadata;
    if (extension === 'flow-meta.xml') {
      metadata = new Flow(conn, extension, pathParsed);
    } else if (extension === 'field-meta.xml') {
      metadata = new Field(conn, extension, pathParsed);
    } else if (extension === 'validationRule-meta.xml') {
      metadata = new ValidationRule(conn, extension, pathParsed);
    } else if (extension === 'flexipage-meta.xml') {
      metadata = new FlexiPage(conn, extension, pathParsed);
    } else if (extension === 'profile-meta.xml') {
      metadata = new Profile(conn, extension, pathParsed);
    } else if (extension === 'permissionset-meta.xml') {
      metadata = new PermissionSet(conn, extension, pathParsed);
    } else if (extension === 'permissionsetgroup-meta.xml') {
      metadata = new PermissionSetGroup(conn, extension, pathParsed);
    } else if (extension === 'cls') {
      metadata = new ApexClass(conn, extension, pathParsed);
    } else if (extension === 'trigger') {
      metadata = new ApexTrigger(conn, extension, pathParsed);
    } else if (extension === 'recordType-meta.xml') {
      metadata = new RecordType(conn, extension, pathParsed);
    } else if (extension === 'layout-meta.xml') {
      metadata = new PageLayout(conn, extension, pathParsed);
    } else if (extension === 'object-meta.xml') {
      metadata = new SObject(conn, extension, pathParsed);
    } else if (extension === 'globalValueSet-meta.xml') {
      metadata = new GlobalValueSet(conn, extension, pathParsed);
    } else if (extension === 'quickAction-meta.xml') {
      metadata = new QuickAction(conn, extension, pathParsed);
    } else if (extension === 'approvalProcess-meta.xml') {
      metadata = new ApprovalProcess(conn, extension, pathParsed);
    } else {
      throw new Error('Unsupported metadata type');
    }

    return metadata;
  };
}

class Metadata {
  protected extension: string;
  protected pathParsed: path.ParsedPath;
  protected metadataApiName: string;
  protected conn: Connection;

  public constructor(conn: Connection, extension: string, pathParsed: path.ParsedPath) {
    this.conn = conn;
    this.extension = extension;
    this.pathParsed = pathParsed;
    this.metadataApiName = pathParsed.base.substring(0, pathParsed.base.length - (extension.length + 1));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getUrl(): Promise<string> {
    // This method should be implemented by subclasses
    throw new Error('Method not implemented');
  }
}

class ApprovalProcess extends Metadata {
  public async getUrl(): Promise<string> {
    const res = await this.conn.query(
      `SELECT Id FROM ProcessDefinition WHERE DeveloperName = '${
        this.metadataApiName.split('.')[1]
      }' AND Type = 'Approval'`
    );

    if (res.records.length === 0) {
      throw new Error(`Approval process not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/ApprovalProcesses/page?address=%2F${res.records[0].Id}`;
  }
}

class SObject extends Metadata {
  public async getUrl(): Promise<string> {
    const objectId = await getObjectId(this.conn, this.metadataApiName);
    if (isCustomMetadata(this.metadataApiName)) {
      return `lightning/setup/CustomMetadata/page?address=%2F${objectId}%3Fsetupid%3DCustomMetadata`;
    } else if (isPlatformEvent(this.metadataApiName)) {
      return `lightning/setup/EventObjects/page?address=%2F${objectId}%3Fsetupid%3DEventObjects`;
    } else {
      return `lightning/setup/ObjectManager/${objectId}/Details/view`;
    }
  }
}

class GlobalValueSet extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling
      .sobject('GlobalValueSet')
      .find({ DeveloperName: this.metadataApiName })
      .execute();

    if (records.length === 0) {
      throw new Error(`GlobalValueSet not found for ${this.metadataApiName}`);
    }
    return `lightning/setup/Picklists/page?address=%2F${records[0].Id}`;
  }
}

class QuickAction extends Metadata {
  public async getUrl(): Promise<string> {
    const splitObjectNameLayoutName = this.metadataApiName.split('.');
    const objectName = splitObjectNameLayoutName[0];
    const quickActionName = splitObjectNameLayoutName[1];

    const objIdPromise = getObjectId(this.conn, objectName);
    const quickActionPromise = this.conn.tooling
      .sobject('QuickActionDefinition')
      .find({ DeveloperName: quickActionName })
      .execute();

    const [objectId, quickActionRecords] = await Promise.all([objIdPromise, quickActionPromise]);

    if (quickActionRecords.length === 0) {
      throw new Error(`QuickAction not found for ${quickActionName}`);
    }

    return `lightning/setup/ObjectManager/${objectId}/ButtonsLinksActions/${quickActionRecords[0].Id}/view`;
  }
}

class PageLayout extends Metadata {
  public async getUrl(): Promise<string> {
    const splitObjectNameLayoutName = this.metadataApiName.split('-');
    const objectName = splitObjectNameLayoutName[0];
    const layoutName = splitObjectNameLayoutName[1];

    const objIdPromise = getObjectId(this.conn, objectName);
    const layoutPromise = this.conn.tooling
      .sobject('Layout')
      .find({ Name: decodeURIComponent(layoutName) })
      .execute();

    const [objectId, layoutRecords] = await Promise.all([objIdPromise, layoutPromise]);

    if (layoutRecords.length === 0) {
      throw new Error(`Layout not found for ${layoutName}`);
    }

    return `lightning/setup/ObjectManager/${objectId}/PageLayouts/${layoutRecords[0].Id}/view`;
  }
}

class RecordType extends Metadata {
  public async getUrl(): Promise<string> {
    const arrayPath = this.pathParsed.dir.split(path.sep);
    const objectFolderName = arrayPath[arrayPath.length - 2];

    const objIdPromise = getObjectId(this.conn, objectFolderName);
    const recordTypePromise = this.conn.query(
      `SELECT Id, DeveloperName FROM RecordType WHERE DeveloperName = '${this.metadataApiName}'`
    );

    const [objectId, recordTypeResult] = await Promise.all([objIdPromise, recordTypePromise]);

    if (recordTypeResult.records.length === 0) {
      throw new Error(`RecordType not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/ObjectManager/${objectId}/RecordTypes/${recordTypeResult.records[0].Id}/view`;
  }
}

class Flow extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling
      .sobject('FlowDefinition')
      .find({ DeveloperName: this.metadataApiName })
      .execute();

    if (records.length === 0) {
      throw new Error(`Flow not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/Flows/page?address=%2F${records[0].Id}`;
  }
}

class ValidationRule extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling
      .sobject('ValidationRule')
      .find({ ValidationName: this.metadataApiName })
      .execute();

    if (records.length === 0) {
      throw new Error(`ValidationRule not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/ObjectManager/${records[0].EntityDefinitionId}/ValidationRules/${records[0].Id}/view`;
  }
}

class FlexiPage extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling
      .sobject('FlexiPage')
      .find({ DeveloperName: this.metadataApiName })
      .execute();

    if (records.length === 0) {
      throw new Error(`FlexiPage not found for ${this.metadataApiName}`);
    }

    return `visualEditor/appBuilder.app?id=${records[0].Id}`;
  }
}

class Profile extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling.sobject('Profile').find({ Name: this.metadataApiName }).execute();

    if (records.length === 0) {
      throw new Error(`Profile not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/EnhancedProfiles/page?address=%2F${records[0].Id}`;
  }
}

class PermissionSet extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling.sobject('PermissionSet').find({ Name: this.metadataApiName }).execute();

    if (records.length === 0) {
      throw new Error(`PermissionSet not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/PermSets/page?address=%2F${records[0].Id}`;
  }
}

class PermissionSetGroup extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling
      .sobject('PermissionSetGroup')
      .find({ DeveloperName: this.metadataApiName })
      .execute();

    if (records.length === 0) {
      throw new Error(`PermissionSetGroup not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/PermSetGroups/page?address=%2F${records[0].Id}`;
  }
}

class ApexClass extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling.sobject('ApexClass').find({ Name: this.metadataApiName }).execute();

    if (records.length === 0) {
      throw new Error(`ApexClass not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/ApexClasses/page?address=%2F${records[0].Id}`;
  }
}

class ApexTrigger extends Metadata {
  public async getUrl(): Promise<string> {
    const records = await this.conn.tooling.sobject('ApexTrigger').find({ Name: this.metadataApiName }).execute();

    if (records.length === 0) {
      throw new Error(`ApexTrigger not found for ${this.metadataApiName}`);
    }

    return `lightning/setup/ApexTriggers/page?address=%2F${records[0].Id}`;
  }
}

class Field extends Metadata {
  public async getUrl(): Promise<string> {
    let url: string;
    const arrayPath = this.pathParsed.dir.split(path.sep);
    const objectFolderName = arrayPath[arrayPath.length - 2];

    if (isStandardField(this.metadataApiName)) {
      // For standard fields, we can use developerName as Id
      if (this.metadataApiName.endsWith('Id')) {
        this.metadataApiName = this.metadataApiName.substring(0, this.metadataApiName.length - 2);
      }
      url = `lightning/setup/ObjectManager/${objectFolderName}/FieldsAndRelationships/${this.metadataApiName}/view`;
    } else {
      this.metadataApiName = getObjectFieldDeveloperName(this.metadataApiName);
      const objectId = await getObjectId(this.conn, objectFolderName);

      const fieldRecords = await this.conn.tooling
        .sobject('CustomField')
        .find({ DeveloperName: this.metadataApiName, TableEnumOrId: objectId })
        .execute();

      if (fieldRecords.length === 0) {
        throw new Error(`Field not found for ${this.metadataApiName}`);
      }

      const fieldData = fieldRecords[0];

      if (isCustomMetadata(objectFolderName)) {
        url = `lightning/setup/CustomMetadata/page?address=%2F${fieldData.Id}%3Fsetupid%3DCustomMetadata`;
      } else if (isPlatformEvent(objectFolderName)) {
        url = `lightning/setup/EventObjects/page?address=%2F${fieldData.Id}%3Fsetupid%3DEventObjects`;
      } else {
        url = `lightning/setup/ObjectManager/${objectId}/FieldsAndRelationships/${fieldData.Id}/view`;
      }
    }
    return url;
  }
}
