//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const GitHubStrategy = require("passport-github2").Strategy;

const app = express();

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
    cookie: {}
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/userDB');

const userSchema = new mongoose.Schema({
   email: String,
   password: String,
   googleId: String,
   secret: String
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)



const User = new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
// passport.serializeUser(User.serializeUser());
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/github/secrets"
},
function(accessToken, refreshToken, profile, done) {
  User.findOrCreate({ githubId: profile.id }, function (err, user) {
    return done(err, user);
  });
}
));


app.get("/",(req,res)=>{
    res.render("home")
})
app.get('/auth/google',
  passport.authenticate('google', { scope: ["profile"] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});

app.get('/auth/github',
  passport.authenticate('github', { scope: ["profile"] }));

app.get('/auth/github/secrets', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login",(req,res)=>{
    res.render("login")
})
app.get("/register",(req,res)=>{
    res.render("register")
})
app.get("/secrets",(req,res)=>{
    User.find({"secret":{$ne: null}})
        .then(foundUsers=>{
          res.render("secrets",{userWithSecrets: foundUsers})
        }).catch(err=>{
          console.log(err)
        }) 
})
app.get("/submit",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("submit")
  } else {
    res.redirect("/login")
  }
})
app.get("/logout",(req,res)=>{
    req.logout(()=>{
        res.redirect("/");
    });
})

app.post("/register",(req,res)=>{
    User.register({username: req.body.username}, req.body.password)
        .then(()=>{
            passport.authenticate("local")(req,res,()=>{
                res.redirect("/secrets")
            })
        }).catch(console.log("error"))
})

app.post("/login",(req,res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.logIn(user,err=>{
     if(err){
        console.log(err)
     } else {
        passport.authenticate("local")(req,res,()=>{
            res.redirect("/secrets")
        })
     }
    })
})

app.post("/submit",(req,res)=>{
  const submittedSecret = req.body.secret;
  User.findById(req.user.id)
      .then(foundUser=>{
        foundUser.secret = submittedSecret;
        foundUser.save().then(()=>{
          res.redirect("/secrets")
        })
      }).catch(err=>{
        console.log(err)
      })
})


app.listen(3000,()=>{
    console.log("Server started on port 3000")
})