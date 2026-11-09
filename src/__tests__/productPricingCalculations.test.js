import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PriceSection, OperativeSection } from '../components/ProductFormSections';
import { useAuthStore } from '../store/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve(null)),
}));

describe('Product Pricing and Calculations Section', () => {
    beforeEach(() => {
        useAuthStore.setState({ userRole: 'admin' });
        AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
    });

    test('hides the price calculator when its floating launcher has not been used', () => {
        const { queryByText, getByText } = render(
            <PriceSection
                productId="test_hidden_calculator"
                formData={{ cost_price: '5000', sale_price: '10000', sale_price_cordoba: '12000' }}
                handleChange={jest.fn()}
                calculatorVisible={false}
                onCloseCalculator={jest.fn()}
            />
        );

        expect(getByText('Costo')).toBeTruthy();
        expect(queryByText('CALCULADORA DE PRECIOS')).toBeNull();
    });

    test('renders calculation section with base price, costs, margin, and final price', () => {
        const formData = {
            cost_price: '5000',
            sale_price: '12000',
            sale_price_cordoba: '13500',
            profit_margin_percent: '50',
            packaging_type: 'general',
        };
        const handleChange = jest.fn();

        const { getByText, queryByText, getByPlaceholderText } = render(
            <PriceSection
                productId="test_prod_1"
                formData={formData}
                handleChange={handleChange}
            />
        );

        // Header
        expect(getByText('CÁLCULOS DEL PRODUCTO')).toBeTruthy();

        // Left Column items in exact order:
        expect(getByText('PRECIO BASE')).toBeTruthy();
        expect(getByText('GASTOS NECESARIOS')).toBeTruthy();
        expect(getByText('MARGEN DE GANANCIA (%)')).toBeTruthy();
        expect(getByText('PRECIO C/ TODO SUMADO')).toBeTruthy();
        expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();

        // Verify "Precio Sugerido" is removed (redundant)
        expect(queryByText('PRECIO SUGERIDO')).toBeNull();

        // Right Column: Margen Bruto
        expect(getByText('MARGEN BRUTO')).toBeTruthy();
        expect(getByText('(Precio Venta - Costos Necesarios)')).toBeTruthy();

        // Editable profit margin input
        const marginInput = getByPlaceholderText('50');
        expect(marginInput.props.value).toBe('50');

        // Typing in the margin input calls handleChange for profit_margin_percent
        fireEvent.changeText(marginInput, '60');
        expect(handleChange).toHaveBeenCalledWith('profit_margin_percent', '60');
    });

    test('switches role view between Admin (60%) and Socio (40%) and updates calculations', () => {
        const formData = {
            cost_price: '5000',
            sale_price: '10000',
            sale_price_cordoba: '12000',
            profit_margin_percent: '50',
            packaging_type: 'general',
        };
        const handleChange = jest.fn();

        const { getByText } = render(
            <PriceSection
                productId="test_prod_2"
                formData={formData}
                handleChange={handleChange}
            />
        );

        // Commission share is shown for the selected person, without changing sale price.
        expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();
        expect(getByText('Luz, Net, M.O., Bolsita+Stickers')).toBeTruthy();

        // Switch to Socio view
        const socioButton = getByText('Socio (Córdoba)');
        fireEvent.press(socioButton);

        // Córdoba price view includes the region's operating costs.
        expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();
        expect(getByText('Luz, Net, Transp., M.O., Bolsita+Stk')).toBeTruthy();
    });

    test('adapts default view when userRole is socio (seller)', () => {
        useAuthStore.setState({ userRole: 'seller' });

        const formData = {
            cost_price: '4000',
            sale_price: '8000',
            sale_price_cordoba: '9000',
            profit_margin_percent: '50',
            packaging_type: 'general',
        };

        const { getByText } = render(
            <PriceSection
                productId="test_prod_3"
                formData={formData}
                handleChange={jest.fn()}
            />
        );

        // Default for socio should be Córdoba view.
        expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();
        expect(getByText('Luz, Net, Transp., M.O., Bolsita+Stk')).toBeTruthy();
    });

    test('OperativeSection renders packaging selector with General, Tarjetas RFID/NFC, and Sin Bolsita', () => {
        const formData = {
            provider: 'Proveedor Test',
            packaging_type: 'general',
        };
        const handleChange = jest.fn();

        const { getByText } = render(
            <OperativeSection
                formData={formData}
                handleChange={handleChange}
                suppliersList={[{ name: 'Proveedor Test' }]}
                isBundle={false}
                onToggleBundle={jest.fn()}
                isIndividual={false}
                onToggleIndividual={jest.fn()}
                bundleItems={[]}
                onShowBundlePicker={jest.fn()}
                onShowSupplierModal={jest.fn()}
            />
        );

        expect(getByText('PACKAGING (BOLSITA + STICKERS)')).toBeTruthy();
        expect(getByText('General (Todos)')).toBeTruthy();
        expect(getByText('Tarjetas RFID/NFC')).toBeTruthy();
        expect(getByText('Sin Bolsita')).toBeTruthy();

        // Tap Tarjetas RFID/NFC
        fireEvent.press(getByText('Tarjetas RFID/NFC'));
        expect(handleChange).toHaveBeenCalledWith('packaging_type', 'rfid');
        expect(handleChange).toHaveBeenCalledWith('packaging_cost', '60');

        // Tap Sin Bolsita
        fireEvent.press(getByText('Sin Bolsita'));
        expect(handleChange).toHaveBeenCalledWith('packaging_type', 'none');
        expect(handleChange).toHaveBeenCalledWith('packaging_cost', '0');
    });

    test('OperativeSection renders packaging price input and allows editing custom packaging cost', () => {
        const formData = {
            provider: 'Proveedor Test',
            packaging_type: 'general',
            packaging_cost: '65',
        };
        const handleChange = jest.fn();

        const { getByText, getByDisplayValue } = render(
            <OperativeSection
                formData={formData}
                handleChange={handleChange}
                suppliersList={[]}
                isBundle={false}
                onToggleBundle={jest.fn()}
                isIndividual={false}
                onToggleIndividual={jest.fn()}
                bundleItems={[]}
                onShowBundlePicker={jest.fn()}
                onShowSupplierModal={jest.fn()}
            />
        );

        expect(getByText('PRECIO / COSTO DE BOLSITA ($)')).toBeTruthy();
        const input = getByDisplayValue('65');
        expect(input).toBeTruthy();

        // Edit the price input directly
        fireEvent.changeText(input, '120');
        expect(handleChange).toHaveBeenCalledWith('packaging_cost', '120');
    });

    test('OperativeSection exposes a separate sticker cost input', () => {
        const handleChange = jest.fn();
        const { getByText, getByDisplayValue } = render(
            <OperativeSection
                formData={{
                    provider: '',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '12',
                }}
                handleChange={handleChange}
                suppliersList={[]}
                isBundle={false}
                onToggleBundle={jest.fn()}
                isIndividual={false}
                onToggleIndividual={jest.fn()}
                bundleItems={[]}
                onShowBundlePicker={jest.fn()}
                onShowSupplierModal={jest.fn()}
            />
        );

        expect(getByText('PRECIO / COSTO DE STICKERS ($)')).toBeTruthy();
        fireEvent.changeText(getByDisplayValue('12'), '20');
        expect(handleChange).toHaveBeenCalledWith('packaging_sticker_cost', '20');
    });

    test('PriceSection integrates custom packaging_cost into base costs and calculations', () => {
        const formData = {
            cost_price: '5000',
            sale_price: '15000',
            sale_price_cordoba: '16000',
            profit_margin_percent: '50',
            packaging_type: 'general',
            packaging_cost: '200',
        };
        const handleChange = jest.fn();

        const { getByText } = render(
            <PriceSection
                productId="test_prod_pkg"
                formData={formData}
                handleChange={handleChange}
            />
        );

        expect(getByText('CÁLCULOS DEL PRODUCTO')).toBeTruthy();
        expect(getByText('PRECIO C/ TODO SUMADO')).toBeTruthy();
    });

    test('PriceSection ignores stale saved calculator cost and uses the product cost', async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => (
            key === 'original_cost_test_stale'
                ? '99999'
                : null
        ));

        const { getByText } = render(
            <PriceSection
                productId="test_stale"
                formData={{
                    cost_price: '5000',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    packaging_type: 'none',
                    packaging_cost: '0',
                    packaging_sticker_cost: '0',
                }}
                handleChange={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(getByText('$5.000,00')).toBeTruthy();
        });

        fireEvent.press(getByText('Ver desglose detallado de gastos'));
        expect(getByText('$5000.00')).toBeTruthy();
    });

    test('calculator physical cost edits the same product cost field', () => {
        const handleChange = jest.fn();
        const { getByLabelText, getAllByDisplayValue } = render(
            <PriceSection
                productId="test_cost_input"
                formData={{
                    cost_price: '5000',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                }}
                handleChange={handleChange}
            />
        );

        fireEvent.press(getByLabelText('Configurar cálculos del producto'));
        const costInputs = getAllByDisplayValue('5000');
        fireEvent.changeText(costInputs[costInputs.length - 1], '5818.78');

        expect(handleChange).toHaveBeenCalledWith('cost_price', '5818.78');
    });

    test('PriceSection visibly includes labor and adds bag, sticker, and service costs', async () => {
        const { getByText } = render(
            <PriceSection
                productId="test_prod_labor_stickers"
                formData={{
                    cost_price: '5000',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '12',
                }}
                handleChange={jest.fn()}
            />
        );

        expect(getByText('MANO DE OBRA')).toBeTruthy();
        expect(getByText('$1.218,75')).toBeTruthy();
        await waitFor(() => {
            expect(getByText(/Bolsita \$65,00 \+ Stickers \$12,00 \+ Servicios \$160,00/)).toBeTruthy();
        });
    });

    test('gross margin percentage is calculated against sale price', async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => (
            key === 'global_calc_params'
                ? JSON.stringify({
                    laborType: 'fijo',
                    customLaborCost: '600',
                    electricityJujuy: '86000',
                    internetJujuy: '0',
                    unitsMonthlyJujuy: '50',
                    electricityCordoba: '140000',
                    internetCordoba: '0',
                    unitsMonthlyCordoba: '50',
                    transportCordoba: '0',
                })
                : null
        ));

        const { getByText } = render(
            <PriceSection
                productId="test_gross_margin"
                formData={{
                    cost_price: '5818.78',
                    sale_price: '24100',
                    sale_price_cordoba: '24100',
                    profit_margin_percent: '60',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '115',
                }}
                handleChange={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(getByText('+$15.781')).toBeTruthy();
            expect(getByText('+65.5%')).toBeTruthy();
        });
    });

    test("adds each person's percentage after city costs and margin", async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => (
            key === 'global_calc_params'
                ? JSON.stringify({
                    laborType: 'fijo',
                    customLaborCost: '600',
                    electricityJujuy: '86000',
                    internetJujuy: '0',
                    unitsMonthlyJujuy: '50',
                    electricityCordoba: '140000',
                    internetCordoba: '0',
                    unitsMonthlyCordoba: '50',
                    transportCordoba: '0',
                })
                : null
        ));

        const { getByText } = render(
            <PriceSection
                productId="test_city_pricing"
                formData={{
                    cost_price: '5818.78',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    profit_margin_percent: '60',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '115',
                }}
                handleChange={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(getByText('Aplicar Jujuy ($16.305)')).toBeTruthy();
            expect(getByText('Aplicar Córdoba ($17.294)')).toBeTruthy();
            expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();
        });

        fireEvent.press(getByText('Socio (Córdoba)'));
        expect(getByText('PRECIO CON COMISIÓN')).toBeTruthy();
        expect(getByText('Aplicar Córdoba ($17.294)')).toBeTruthy();
    });

    test('uses fixed Cordoba services and includes labor in every product cost', async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => (
            key === 'global_calc_params'
                ? JSON.stringify({
                    laborType: 'fijo',
                    customLaborCost: '600',
                    electricityCordoba: '0',
                    internetCordoba: '0',
                    unitsMonthlyCordoba: '1',
                    transportCordoba: '517.31',
                })
                : null
        ));

        const { getByText } = render(
            <PriceSection
                productId="test_fixed_cordoba_services"
                formData={{
                    name: 'Cable rotativo tipo C',
                    cost_price: '8134',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    profit_margin_percent: '50',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '115',
                }}
                handleChange={jest.fn()}
            />
        );

        fireEvent.press(getByText('Socio (Córdoba)'));
        fireEvent.press(getByText('Ver desglose detallado de gastos'));

        await waitFor(() => {
            expect(getByText('$600,00')).toBeTruthy();
            expect(getByText('$4.097,31')).toBeTruthy();
            expect(getByText('🟠 Servicios Córdoba (fijo por producto):')).toBeTruthy();
            expect(getByText('$2800.00')).toBeTruthy();
            expect(getByText('Aplicar Córdoba ($20.793)')).toBeTruthy();
        });
    });

    test('commission rates are editable separately from the product margin', async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => (
            key === 'global_calc_params'
                ? JSON.stringify({
                    laborType: 'fijo',
                    customLaborCost: '600',
                    electricityJujuy: '86000',
                    internetJujuy: '0',
                    unitsMonthlyJujuy: '50',
                    electricityCordoba: '140000',
                    internetCordoba: '0',
                    unitsMonthlyCordoba: '50',
                    transportCordoba: '0',
                })
                : null
        ));

        const { getByLabelText, getByText } = render(
            <PriceSection
                productId="test_edit_commission"
                formData={{
                    cost_price: '5818.78',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    profit_margin_percent: '60',
                    packaging_type: 'general',
                    packaging_cost: '65',
                    packaging_sticker_cost: '115',
                }}
                handleChange={jest.fn()}
            />
        );

        fireEvent.press(getByLabelText('Configurar cálculos del producto'));
        fireEvent.press(getByText('💸 Comisiones'));
        fireEvent.changeText(getByLabelText('Comisión Admin sobre margen (%)'), '50');

        await waitFor(() => {
            expect(getByText('Aplicar Jujuy ($15.806)')).toBeTruthy();
            expect(getByText('Aplicar Córdoba ($17.294)')).toBeTruthy();
        });
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            'global_calc_params',
            expect.stringContaining('"adminCommissionPercent":"50"')
        );
    });

    test('PriceSection does not charge stickers when packaging is disabled', async () => {
        const { getByText } = render(
            <PriceSection
                productId="test_prod_no_packaging"
                formData={{
                    cost_price: '5000',
                    sale_price: '0',
                    sale_price_cordoba: '0',
                    packaging_type: 'none',
                    packaging_cost: '0',
                    packaging_sticker_cost: '12',
                }}
                handleChange={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(getByText(/Stickers \$0,00/)).toBeTruthy();
        });
    });

    test('auto-detects RFID/NFC packaging for RFID products when not explicitly specified', () => {
        const formData = {
            name: 'Tarjeta de bloqueo RFID/NFC',
            cost_price: '1246',
            sale_price: '9490',
            sale_price_cordoba: '14990',
            profit_margin_percent: '50',
        };
        const handleChange = jest.fn();

        const { getByText } = render(
            <OperativeSection
                formData={formData}
                handleChange={handleChange}
                suppliersList={[]}
                isBundle={false}
                onToggleBundle={jest.fn()}
                isIndividual={false}
                onToggleIndividual={jest.fn()}
                bundleItems={[]}
                onShowBundlePicker={jest.fn()}
                onShowSupplierModal={jest.fn()}
            />
        );

        // Badge shows Tarjetas RFID/NFC as selected
        expect(getByText('💳 Tarjetas RFID/NFC')).toBeTruthy();
    });
});
