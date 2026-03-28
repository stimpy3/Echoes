/*
Mongoose is an ODM (Object Data Modeling) library that lets you define schemas and models
for MongoDB in Node.js.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
  password: { type: String, required: false },//required false because google auth doesnt send password
  profilePic: { type: String, default: ''},
  googleId: { type: String, default: null },//to identify Google accounts
  //why its better to add googleId field
  /*because Every Google account returns a unique, stable identifier called sub in the ID token payload:
    const { email, name, picture, sub } = payload;
    sub is the Google user ID it never changes for that account, even if the user changes their email or name.
    Why googleId is useful but not required

             Scenario	                                        What happens if you don’t store googleId	                         What happens if you do
    User logs in again with Google	                          You find them by email → still works ✅	                              Same behavior ✅
    User changes email in Google                           	Your next login fails (email doesn’t match anymore)       ❌	Still works because you match googleId ✅
    You want to know if account came from Google	                   You have no clean way ❌                               	You can easily check if (user.googleId) ✅
    You later add multi-provider auth (e.g. Apple, GitHub)	           Harder to manage ❌	                                     Cleaner with provider IDs ✅
  */

  home: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  isPrivate: { type: Boolean, default: false }
});

//#region to allow collapse
/*
new mongoose.Schema({...}) creates a schema — a structure/blueprint for how documents (records)
will look inside the User collection.

Inside the schema:
Each key (e.g., name, email, password) is a field in the MongoDB document.

Each field has options in an object:
type: the data type (e.g., String, Number, Date, etc.).
required: true: the field must be present when creating a document.
unique: true: no two documents can have the same value in this field (e.g., no two users
with the same email).

Here are some options for each field
1. type:
String, Number, Date, Boolean, Buffer, Array, Map, Schema.Types.ObjectId, Mixed (any type)

2. required:
true, false
Can also provide a custom error message:
required: [true, 'Email is required']

3. unique:
true, false
Creates a unique index in MongoDB for this field.
Used to ensure no two documents have the same value in this field.
Note: unique is not a validator — it's an index. If you want to validate uniqueness properly, 
you should also handle errors if duplication occurs.
After setting unique: true, ✅ you must handle duplicate key errors (code 11000) when saving data.
Optionally, 🧰 use a plugin like mongoose-unique-validator to get cleaner validation messages
If you don’t handle it, 🚨 your app can crash or return messy server errors when a duplicate is 
inserted.

example of handling such error:-
try {
  await User.create({ email: 'test@example.com' });
} catch (err) {
  if (err.code === 11000) {
    console.log('Email already in use');
    // send a nice response instead of crashing
    return res.status(400).json({ message: 'Email is already registered' });
  } else {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
}


4. Default
createdAt: { type: Date, default: Date.now }
isActive: { type: Boolean, default: true }
Sets a default value if none is provided.


5. Enum (for Strings)
role: { type: String, enum: ['admin', 'user', 'guest'], default: 'user' }
Restricts the field to a set of allowed values.




6. min / max (for Numbers)
age: { type: Number, min: 0, max: 120 }
Validates that numbers are within a range.
Unlike unique: true, which is not a validator and requires you to catch duplicate key errors 
manually, min and max are true Mongoose validators that are automatically checked before saving,

Mongoose validators (like min/max)
Error happens before the database sees the data.
Mongoose throws a ValidationError, which is predictable and easy to handle.
You can rely on it consistently for any save or update.

unique: true
Error happens only when MongoDB tries to save the data.
Mongoose itself doesn’t check—MongoDB throws a duplicate key error (code 11000).
This error is less predictable (it only occurs if the database already has a duplicate)
and requires specific handling.




7. minlength / maxlength (for Strings)
username: { type: String, minlength: 3, maxlength: 20 }
Validates string length. so no error handling likle unique:true

8. match (Regex)
email: { type: String, match: /.+\@.+\..+/ }
Validates that the value matches a regular expression.
The first and last slashes / mark the start and end of the regular expression in JavaScript.
Everything inside them is the pattern that will be tested against the string.

The .+ at the beginning matches one or more of any character except a newline. It ensures
that there is at least one character before the @ symbol.

The \@ matches a literal @ symbol. The backslash escapes the @ so that it is treated as
a normal character rather than a special regex symbol.

The second .+ matches one or more of any character after the @ and before the dot.
This ensures that there is at least one character in the domain part of the email.

The \. matches a literal dot .. The backslash escapes it so that the regex looks for an
actual dot rather than interpreting it as “any character.”

The final .+ matches one or more of any character after the dot, representing the
domain suffix like com or org.



9. validate (Custom Validators)
password: { 
  type: String, 
  validate: {
    validator: function(v) {
      return v.length >= 6;
    },
    message: 'Password must be at least 6 characters long'
  }
}
You can create custom validation logic for complex rules.



10. immutable
createdAt: { type: Date, default: Date.now, immutable: true }
Makes the field read-only after it’s set for the first time.



11. select
password: { type: String, required: true, select: false }
Excludes the field by default when querying.
Useful for sensitive data like passwords.
select: false only affects how Mongoose fetches data from the database.
When you do User.find() or User.findById(), Mongoose won’t include fields marked with select:
false in the result unless you explicitly ask for them.
It does not prevent you from sending that field to the browser. If you manually include 
it in your response, the browser will still see it.
// password has select: false
const user = await User.findById(id);
console.log(user.password); // undefined

// but you can still get it if you explicitly select it
const userWithPassword = await User.findById(id).select('+password');
console.log(userWithPassword.password); // shows the password


13. get / set
Transform data when getting or setting values.
price: { 
  type: Number,
  get: v => (v / 100).toFixed(2),  // stored as 1000, returned as "10.00"
  set: v => v * 100               // input 10.00 stored as 1000
}
Even though the frontend could “change how it looks,” get/set in Mongoose ensures data is
stored safely, always retrieved consistently, and works reliably across all backends and clients.

If you want, I can give a real example with price calculations showing why storing in cents + 
get formatting is safer than only changing it in the frontend. Do you want me to?



12. index / sparse / unique combos
username: { type: String, index: true }        // creates an index
email: { type: String, unique: true, sparse: true } 
index: creates an index to improve query performance.

Here are the drawbacks of indexes:
Slower writes – Every insert, update, or delete must also update the index, which can 
reduce write performance.
More storage – Indexes take extra disk space, especially if you create many of them.
Unnecessary if unused – Indexes on rarely queried fields waste resources without any performance
benefit.

sparse: only indexes documents that have this field set.
The sparse option is just a tool for controlling how indexes work.
Without sparse, a unique index will treat missing or null values as duplicates, which can cause
errors if some documents don’t have that field.
With sparse: true, MongoDB ignores documents where the field is missing when enforcing uniqueness.







Bonus: Schema-level options (not field-level)
When defining a schema, you can also pass a second options object like:
const schema = new mongoose.Schema({...}, { timestamps: true, versionKey: false });
timestamps: true → auto-adds createdAt and updatedAt.
versionKey: false → removes the __v field.
*/
//#endregion



module.exports = mongoose.model('User', userSchema);
