'use strict';

/**
 * Dependencies
 */
const sendgrid = require('sendgrid');
const Mail = sendgrid.mail.Mail;
const Email = sendgrid.mail.Email;
const Content = sendgrid.mail.Content;
const Personalization = sendgrid.mail.Personalization;
const parseIdentity = require('./helpers/parse-identity');

/**
 * Interface
 */
module.exports = {

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
   * Create a Sendgrid Mail object
   */
  createMail(data) {

    //Already a Sendgrid Mail instance?
    if (data instanceof Mail) {
      return data;
    }

    //Extract data
    const {to, from, subject, text, html} = data;

    //Parse sender and recipient identities
    const sender = parseIdentity(from);
    const recipient = parseIdentity(to);

    //Must have recipient
    if (!recipient) {
      throw new Error('Invalid or no recipient specified');
    }

    //Must have sender
    if (!sender) {
      throw new Error('Invalid or no sender specified');
    }

    //Prepare objects
    const mail = new Mail();
    const recipients = new Personalization();

    //Add recipient
    recipients.addTo(new Email(recipient.email, recipient.name));

    //Set personalisation and sender
    mail.addPersonalization(recipients);
    mail.setFrom(new Email(sender.email, sender.name));

    //Set subject
    if (subject) {
      mail.setSubject(subject);
    }

    //Add content
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
   * Create a request to send an email
   */
  createRequest(mail) {

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
    try {
      this.load();
    }
    catch (e) {
      return Promise.reject(e);
    }

    //Convert emails to array
    if (!Array.isArray(mails)) {
      mails = [mails];
    }

    //Convert to Sendgrid Mail instances and then requests
    const requests = mails
      .map(mail => this.createMail(mail))
      .map(mail => this.createRequest(mail));

    //Process all
    return Promise.map(requests, request => this.sg.API(request));
  },
};
