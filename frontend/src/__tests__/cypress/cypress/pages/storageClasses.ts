import type { MockStorageClass } from '~/__mocks__';
import { mockStorageClassList } from '~/__mocks__';
import { appChrome } from '~/__tests__/cypress/cypress/pages/appChrome';
import { TableRow } from '~/__tests__/cypress/cypress/pages/components/table';

class StorageClassesPage {
  visit() {
    cy.visitWithLogin('/storageClasses');
    this.wait();
  }

  private wait() {
    cy.findByTestId('app-page-title').contains('Storage classes');
    cy.testA11y();
  }

  findNavItem() {
    return appChrome.findNavItem('Storage classes', 'Settings');
  }

  findEmptyState() {
    return cy.findByTestId('storage-classes-empty-state');
  }
}

class StorageClassesTableRow extends TableRow {
  findOpenshiftDefaultLabel() {
    return this.find().findByTestId('openshift-sc-default-label');
  }

  findEnableSwitch() {
    return this.find().findByTestId('enable-switch');
  }

  findDefaultRadio() {
    return this.find().findByTestId('set-default-radio');
  }

  findOpenshiftScName() {
    return this.find().find(`[data-label="Openshift storage class"]`);
  }
}

class StorageClassesTable {
  find() {
    return cy.findByTestId('storage-classes-table');
  }

  getRowByName(name: string) {
    return new StorageClassesTableRow(() =>
      this.find().find(`[data-label="Display name"]`).contains(name).parents('tr'),
    );
  }

  findRowByName(name: string) {
    return this.getRowByName(name).find();
  }

  mockUpdateStorageClass(storageClassName: string, times?: number) {
    return cy.interceptOdh(
      `PUT /api/storage-class/:name/config`,
      { path: { name: storageClassName }, times },
      { success: true, error: '' },
    );
  }

  mockGetStorageClasses(storageClasses: MockStorageClass[], times?: number) {
    return cy.interceptOdh(
      'GET /api/k8s/apis/storage.k8s.io/v1/storageclasses',
      { times },
      mockStorageClassList(storageClasses),
    );
  }
}

export const storageClassesPage = new StorageClassesPage();
export const storageClassesTable = new StorageClassesTable();
