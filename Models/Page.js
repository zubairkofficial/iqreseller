const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Page = new Schema({
    page_no:{
        type: String, 
        required: true,
    },
},{
    timestamps: true,
    collection: 'page',
});

module.exports = mongoose.model('Page', Page);