const axios = require("axios");
var products = require('nano')(process.env.PRODUCT_DB_URL)
const log = require('debug')('product-d')
var user_auth_url = (process.env.USER_AUTH_URL)


const logging_url = (process.env.LOGGING_URL)

// Send log to the logging micro service.
function sendLogs(log_send) {
  new Promise((resolve, reject) => {
    log(`${logging_url}/addLog`)
    axios.post(`${logging_url}/addLog`, {
          log: log_send
        })
        .then((res) => {
          log("Success to add logs.")
        })
        .catch((err) => {
          log("Error when adding logs")
        });
      }
    )
}

// Create a log and send it.
function add_logs(product, action) {
  const log_send = {
    "microservice": "admin",
    "action": action,
    "product": product,
    "date": new Date()
  }
  sendLogs(log_send);
  
}

// Ask to the authentification micro service if the token is one of an admin.
async function isAdmin(token) {
  return new Promise((resolve, reject) => {
    axios
    .get(`${user_auth_url}/isAdmin/${token}`)
    .then((res) => {
      log(`Result of request ${typeof(res.data.token.isAdmin)}`)
      resolve(res.data.token.isAdmin)
    })
    .catch((err) => {
      log(err)
      reject(err)
    });
  })
}

// Insert a product the product data base.
function createProduct (product, productcat, productprice, productimg, productDesc) {
  const created_product = { "name": product,
    "category": productcat,
    "price": productprice,
    "image": productimg,
    "description": productDesc
  }
  add_logs(created_product,"CreateProduct");
  return new Promise((resolve, reject) => {
    products.insert(
      created_product,
      product,
      // callback to execute once the request to the DB is complete
      (error, success) => {
        if (success) {
          resolve(success.token)
        } else {
          reject(
            new Error(`In the creation of product (${product}). Reason: ${error.reason}.`)
          )
        }
      }
    )
  })
}

// Recover the list of product of the product data base.
function getProduct () {
  return new Promise((resolve, reject) => {
    // Process the request to the product server
    products.list({ include_docs: true },
      ((error, success) => {
      if (success) {
        var map_by_category = {};
        for(const p of success.rows.map(row => row.doc)) {
            var cat = p["category"]
            if(!(cat in map_by_category)) {
              map_by_category[cat] = []
            }
            p["id"] = p["_id"]
            map_by_category[cat].push(p)
        }
        resolve(map_by_category)
      } else {
        reject(new Error(`Error GET products: ${error.reason}`))
      }
    }))
  })
}

// Delete a product in the product data base.
function deleteProduct(_id, _rev) {
  add_logs(_id, "DeleteProduct")
  return new Promise((resolve, reject) => {
    // Process the request to the product server
    products.destroy(_id, _rev,
      ((error, success) => {
      if (success) {
        resolve(success)
      } else {
        reject(new Error(`Error when DELETE products ${_id}: ${error.reason}`))
      }
    }))
  })
}

// Update a product in the product database.
function updateProduct(product, productcat, productprice, productimg, rev, _id, productdesc) {
  product_update = {"_id": _id,
    "_rev": rev,
    "name": product,
    "category": productcat,
    "price": productprice,
    "image": productimg,
    "description": productdesc
  }
  add_logs(product_update, "UpdateProduct")
  return new Promise((resolve, reject) => {
    // Process the request to the product server
    products.insert(
      product_update,
      (error, success) => {
        if (success) {
          resolve(success.token)
        } else {
          reject(
            new Error(`In the modification of product (${product}). Reason: ${error.reason}.`)
          )
        }
      }
    );
  })
}

module.exports = {
  createProduct,
  getProduct,
  deleteProduct,
  updateProduct,
  isAdmin
}
