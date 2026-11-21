/**
 * SQL Security Utilities
 * Protects against SQL injection in dynamic sorting / ordering clauses.
 */

/**
 * Safely normalizes and validates sort parameters for Sequelize order clauses.
 * Prevents raw SQL injection into order clauses.
 * 
 * @param {Array<string>|string} sort - Sort query parameter, e.g. ['id', 'DESC']
 * @param {Array<string>} [allowedColumns] - Optional whitelist of allowed column names
 * @param {string} [defaultCol='id'] - Fallback column name
 * @param {string} [defaultDir='DESC'] - Fallback sort direction
 * @returns {Array<[string, string]>} Safe order clause for Sequelize
 */
function safeOrder(sort, allowedColumns = [], defaultCol = 'id', defaultDir = 'DESC') {
    let col = defaultCol;
    let dir = defaultDir;

    if (Array.isArray(sort) && sort.length > 0) {
        const rawCol = String(sort[0] || '').trim();
        const rawDir = String(sort[1] || '').trim().toUpperCase();

        if (allowedColumns.length > 0) {
            if (allowedColumns.includes(rawCol)) {
                col = rawCol;
            }
        } else if (/^[a-zA-Z0-9_]+$/.test(rawCol)) {
            // Only allow strict alphanumeric and underscores if no whitelist given
            col = rawCol;
        }

        if (rawDir === 'ASC' || rawDir === 'DESC') {
            dir = rawDir;
        }
    } else if (typeof sort === 'string') {
        const rawCol = sort.trim();
        if (allowedColumns.length > 0) {
            if (allowedColumns.includes(rawCol)) {
                col = rawCol;
            }
        } else if (/^[a-zA-Z0-9_]+$/.test(rawCol)) {
            col = rawCol;
        }
    }

    return [[col, dir]];
}

module.exports = {
    safeOrder
};
