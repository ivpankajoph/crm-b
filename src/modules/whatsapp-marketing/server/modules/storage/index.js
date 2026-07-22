import * as mongodb from "./mongodb.adapter.js";
async function readCollection(collection) {
  return mongodb.readCollection(collection);
}
async function writeCollection(collection, data) {
  return mongodb.writeCollection(collection, data);
}
async function addItem(collection, item) {
  const result = await mongodb.insertOne(collection, item);
  return result || item;
}
async function updateItem(collection, id, updates) {
  return mongodb.updateOne(collection, { id }, updates);
}
async function deleteItem(collection, id) {
  return mongodb.deleteOne(collection, { id });
}
async function findById(collection, id) {
  return mongodb.findOne(collection, { id });
}
async function findByField(collection, field, value) {
  return mongodb.findOne(collection, { [field]: value });
}
async function updateManyItems(collection, query, updates) {
  return mongodb.updateMany(collection, query, updates);
}
import { connectToMongoDB } from "./mongodb.adapter.js";
export {
  addItem,
  connectToMongoDB,
  deleteItem,
  findByField,
  findById,
  readCollection,
  updateItem,
  updateManyItems,
  writeCollection
};
