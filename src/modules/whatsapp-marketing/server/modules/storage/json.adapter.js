import * as fs from "fs";
import * as path from "path";
const DATA_DIR = path.join(process.cwd(), "data");
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}
function getFilePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}
function readCollection(collection) {
  ensureDataDir();
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]");
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
function writeCollection(collection, data) {
  ensureDataDir();
  const filePath = getFilePath(collection);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function addItem(collection, item) {
  const items = readCollection(collection);
  items.push(item);
  writeCollection(collection, items);
  return item;
}
function updateItem(collection, id, updates) {
  const items = readCollection(collection);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates };
  writeCollection(collection, items);
  return items[index];
}
function deleteItem(collection, id) {
  const items = readCollection(collection);
  const filtered = items.filter((item) => item.id !== id);
  if (filtered.length === items.length) return false;
  writeCollection(collection, filtered);
  return true;
}
function findById(collection, id) {
  const items = readCollection(collection);
  return items.find((item) => item.id === id) || null;
}
function findByField(collection, field, value) {
  const items = readCollection(collection);
  return items.find((item) => item[field] === value) || null;
}
export {
  addItem,
  deleteItem,
  findByField,
  findById,
  readCollection,
  updateItem,
  writeCollection
};
