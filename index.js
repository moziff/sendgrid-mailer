'use strict';

/**
 * Dependencies
 */
const sendgrid = require('sendgrid');
const Mail = sendgrid.mail.Mail;
const Email = sendgrid.mail.Email;
const Content = sendgrid.mail.Content;
const Personalization = sendgrid.mail.Personalization;
const splitNameEmail = require('./split-name-email');

/**
 * Interface
 */
module.exports = {

  //Promise implementation (can be overwritten)
  Promise: Promise,

  //Sendgrid instance
  sg: null,

  //Default options
  options: {
    apiKey: '',
  },

  /**
   * Configure
   */
  config(options) {

    //String given? Assume only API key
    if (typeof options === 'string') {
      options = {apiKey: options};
    }

    //Merge options
    Object.assign(this.options, options || {});
  },

  /**
   * Load sendgrid instance
   */
  load() {

    //Not loaded yet?
    if (!this.sg) {

      //Must have API key
      if (!this.options.apiKey) {
        throw new Error('Missing Sendgrid API key');
      }

      //Initialize
      this.sg = sendgrid(this.options.apiKey);
    }

    //Return
    return this.sg;
  },

  /**
   * Create Sendgrid Email instance
   */
  createEmail(identity) {

    //Already an Email instance?
    if (identity instanceof Email) {
      return identity;
    }

    //Initialize
    let name, email;

    //Extract name and email if string given
    if (typeof identity === 'string') {
      [name, email] = splitNameEmail(identity);
    }

    //If object, extract
    else if (typeof identity === 'object' && identity !== null) {
      ({name, email}) = identity;
    }

    //Invalid
    else {
      throw new Error('Invalid identity provided: ' + identity);
    }

    //Must have email
    if (!email) {
      throw new Error('Email required for identity: ' + identity);
    }

    //Create instance
    return new Email(email, name);
  },

  /**
   * Create a Sendgrid Mail instance
   */
  createMail(data) {

    //Already a Sendgrid Mail instance?
    if (data instanceof Mail) {
      return data;
    }

    //Extract data
    const {to, from, subject, text, html} = data;

    //Convert sender and recipient to Email instances
    const sender = this.createEmail(from);
    const recipient = this.createEmail(to);

    //Prepare objects
    const mail = new Mail();
    const recipients = new Personalization();

    //Add recipient
    recipients.addTo(recipient);

    //Set personalisation, sender and subject
    mail.addPersonalization(recipients);
    mail.setFrom(sender);
    mail.setSubject(subject || '');

    //Add content as applicable
    if (text) {
      mail.addContent(new Content('text/plain', text));
    }
    if (html) {
      mail.addContent(new Content('text/html', html));
    }

    //Return it
    return mail;
  },

  /**
   * Create a Sendgrid Request instance
   */
  createRequest(mail) {

    //Ensure it's a Mail instance
    mail = this.createMail(mail);

    //Build request
    const request = this.sg.emptyRequest();
    request.method = 'POST';
    request.path = '/v3/mail/send';
    request.body = mail.toJSON();

    //Return it
    return request;
  },

  /**
   * Send one or more emails
   */
  send(mails) {

    //Load sendgrid instance on demand
    this.load();

    //Convert emails to array
    if (!Array.isArray(mails)) {
      mails = [mails];
    }

    //Convert to Sendgrid requests
    const promises = mails
      .map(mail => this.createRequest(mail))
      .map(request => this.sg.API(request));

    //Process all
    return Promise.all(promises);
  },
};
