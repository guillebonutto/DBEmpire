/**
 * Utility functions for business logic calculations.
 * Extracted for easier unit testing.
 */

export const BusinessLogic = {
    /**
     * Calculates the net profit/balance based on income and expenses.
     * @param {number} income - Total sales income for the period
     * @param {number} expenses - Total expenses for the period
     * @param {number} historicalBalance - Balance prior to the current period
     * @returns {number}
     */
    calculateNetBalance: (income, expenses, historicalBalance = 0) => {
        return (parseFloat(historicalBalance) || 0) + (parseFloat(income) || 0) - (parseFloat(expenses) || 0);
    },

    /**
     * Calculates a percentage-based commission.
     * @param {number} amount - Total amount to calculate commission from
     * @param {number} ratePercent - Commission rate in percentage (e.g., 10 for 10%)
     * @returns {number}
     */
    calculateCommission: (amount, ratePercent) => {
        const amt = parseFloat(amount) || 0;
        const rate = parseFloat(ratePercent) || 0;
        return (amt * rate) / 100;
    },

    /**
     * Calculates the ROI percentage.
     * @param {number} totalInvestment - Total expenses/investment
     * @param {number} totalIncome - Total sales income
     * @returns {number} ROI as a percentage (e.g., 20 for 20% gain)
     */
    calculateROI: (totalInvestment, totalIncome) => {
        const inv = parseFloat(totalInvestment) || 0;
        const inc = parseFloat(totalIncome) || 0;
        if (inv === 0) return 0;
        return ((inc - inv) / inv) * 100;
    },

    /**
     * Classifies order items into 'Auto-Update' or 'Review' based on cost changes.
     */
    classifyOrderItems: (items, products) => {
        const toAutoUpdate = [];
        const toReview = [];

        items.forEach(item => {
            if (!item.product_id) {
                // Unlinked items always go to review
                toReview.push({ ...item, isNew: true });
                return;
            }

            const product = products.find(p => p.id === item.product_id);
            if (!product) {
                toReview.push({ ...item, isNew: true });
                return;
            }

            const currentCost = parseFloat(product.cost_price) || 0;
            const newCost = parseFloat(item.cost_per_unit) || 0;

            if (Math.abs(currentCost - newCost) > 0.01) {
                toReview.push({ ...item, product });
            } else {
                toAutoUpdate.push({ item, product });
            }
        });

        return { toAutoUpdate, toReview };
    }
};
