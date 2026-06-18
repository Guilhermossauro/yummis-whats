function normalizeStockItems(items) {
  const grouped = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const quantity = Math.max(1, Number(item?.quantidade || 1));
    const key = item?.id ? `id:${item.id}` : item?.codigo ? `codigo:${String(item.codigo).toLowerCase()}` : null;
    if (!key) continue;

    const current = grouped.get(key);
    if (current) {
      current.quantidade += quantity;
      continue;
    }

    grouped.set(key, item?.id
      ? { id: item.id, quantidade: quantity }
      : { codigo: item.codigo, quantidade: quantity });
  }

  return Array.from(grouped.values());
}

function decrementStockForItems({ db, userId, items, mapProduct = (row) => row, operationKey }) {
  const normalizedItems = normalizeStockItems(items);
  const updated = [];
  let applied = true;

  const tx = db.transaction((rows) => {
    if (operationKey) {
      const inserted = db.prepare(
        'INSERT OR IGNORE INTO stock_operations (owner_id, operation_key, created_at) VALUES (?, ?, ?)'
      ).run(userId, operationKey, new Date().toISOString());

      if (inserted.changes === 0) {
        applied = false;
        return;
      }
    }

    for (const item of rows) {
      const product = item.id
        ? db.prepare('SELECT * FROM products WHERE id = ? AND owner_id = ?').get(item.id, userId)
        : db.prepare('SELECT * FROM products WHERE codigo = ? AND owner_id = ?').get(item.codigo, userId);

      if (!product) continue;

      const nextStock = Math.max(0, Number(product.estoque || 0) - item.quantidade);
      db.prepare('UPDATE products SET estoque = ? WHERE id = ? AND owner_id = ?').run(nextStock, product.id, userId);
      updated.push(mapProduct({ ...product, estoque: nextStock }));
    }
  });

  tx(normalizedItems);
  return { applied, products: updated };
}

module.exports = {
  normalizeStockItems,
  decrementStockForItems,
};
