import { t, format } from './templating';

const MPC_BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612];

interface AutofillSlot {
    name : string;
    ext  : string;
    slots: number[];
}
interface AutofillData {
    quantity: number;
    fronts  : AutofillSlot[];
    backs   : AutofillSlot[];
}

/** Generates a config file for MPC autofill. */
export function generateAutofillXml(data: AutofillData): string {
    const { fronts, backs } = data;

    const sizeBracket = MPC_BRACKETS.find(bracket => bracket >= data.quantity);

    function renderCard(card: AutofillSlot) {
        return t`
            <card>
                <id>${card.name}</id>
                <slots>${card.slots.join(',')}</slots>
                <name>${card.name}.${card.ext}</name>
            </card>
        `;
    }

    return format(t`
        <order>
            <details>
                <quantity>${data.quantity}</quantity> <!-- Total card number -->
                <bracket>${sizeBracket}</bracket>     <!-- Batch size -->
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            <fronts>
                ${fronts.map(renderCard)}
            </fronts>
            <backs>
                ${backs.map(renderCard)}
            </backs>
        </order>
    `);
}
