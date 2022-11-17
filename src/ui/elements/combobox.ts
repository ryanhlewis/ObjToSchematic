import { EAppEvent, EventManager } from '../../event';
import { ASSERT } from '../../util/error_util';
import { LabelledElement } from './labelled_element';

export type ComboBoxItem<T> = {
    id: T;
    displayText: string;
    tooltip?: string;
}

export class ComboBoxElement<T> extends LabelledElement<T> {
    private _items: ComboBoxItem<T>[];

    public constructor(id: string, items: ComboBoxItem<T>[]) {
        super(id);
        this._items = items;
    }

    public generateInnerHTML() {
        let itemsHTML = '';
        for (const item of this._items) {
            itemsHTML += `<option value="${item.id}" title="${item.tooltip || ''}">${item.displayText}</option>`;
        }

        return `
            <select name="${this._id}" id="${this._id}">
                ${itemsHTML}
            </select>
        `;
    }

    public registerEvents(): void {
        const element = document.getElementById(this._id) as HTMLSelectElement;
        ASSERT(element !== null);

        element.addEventListener('change', () => {
            EventManager.Get.broadcast(EAppEvent.onComboBoxChanged, element.value);
            if (this._onValueChangedDelegate) {
                this._onValueChangedDelegate(element.value);
            }
        });
    }

    protected getValue() {
        const element = document.getElementById(this._id) as HTMLSelectElement;
        ASSERT(element !== null);
        return this._items[element.selectedIndex].id;
    }

    protected _onEnabledChanged() {
        super._onEnabledChanged();

        const element = document.getElementById(this._id) as HTMLSelectElement;
        ASSERT(element !== null);
        element.disabled = !this._isEnabled;

        this._onValueChangedDelegate?.(element.value);
    }

    private _onValueChangedDelegate?: (value: any) => void;
    public onValueChanged(delegate: (value: any) => void) {
        this._onValueChangedDelegate = delegate;
        return this;
    }
}
