const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SalesOrderSchema = new Schema({
    rep:{
        type: String, 
        required: true,
    },
    soId:{
        type: String, 
        required: true,
    },
    sale_date:{
        type: String,
        required: true,
    }
},{
    timestamps: true,
    collection: 'sales_orders',
});

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);