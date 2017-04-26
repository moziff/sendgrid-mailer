'use strict';

/**
 * Dependencies
 */
const sendgrid = require('sendgrid');
const Mail = sendgrid.mail.Mail;
const Email = sendgrid.mail.Email;
const Content = sendgrid.mail.Content;
const Personalization = sendgrid.mail.Personalization;
const splitNameEmail = require('./helpers/split-name-email');

/**
 * Interface
 */
const mailer = module.exports = {

  //Promise implementation (can be overwritten)
  Promise,

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
    Object.assign(mailer.options, options || {});

    //Return self
    return mailer;
  },

  /**
   * Load sendgrid instance
   */
  load() {

    //Not loaded yet?
    if (!mailer.sg) {

      //Must have API key
      if (!mailer.options.apiKey) {
        throw new Error('Missing Sendgrid API key');
      }

      //Initialize
      mailer.sg = sendgrid(mailer.options.apiKey);
    }

    //Return
    return mailer.sg;
  },

  /**
   * Create Sendgrid Email instance
   */
  createEmail(identity) {

    //Array?
    if (Array.isArray(identity)) {
      return identity.map(item => mailer.createEmail(item));
    }

    //Already an Email instance?
    if (identity instanceof Email) {
      return identity;
    }

    //No identity?
    if (!identity) {
      throw new Error('No identity provided');
    }

    //Extract name and email if string given
    if (typeof identity === 'string') {
      const [name, email] = splitNameEmail(identity);
      identity = {name, email};
    }

    //Check if object
    if (typeof identity !== 'object') {
      throw new Error('Invalid identity provided: ' + identity);
    }

    //Extract name and email
    const {name, email} = identity;

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
    const {
      to, from, subject, text, html, substitutions, templateId, replyTo,
    } = data;

    //Convert sender and recipient to Email instances
    const sender = mailer.createEmail(from);
    const recipient = mailer.createEmail(to);

    //Prepare objects
    const mail = new Mail();

    /**
     * Helper to add personalization
     */
    function addPersonalization(recipient, substitutions) {
      const personalization = new Personalization();
      personalization.addTo(recipient);
      if (substitutions) {
        personalization.substitutions = substitutions;
      }
      mail.addPersonalization(personalization);
    }

    //Add recipients
    if (Array.isArray(recipient)) {
      recipient.forEach((identity, i) => {
        const sub = (substitutions && substitutions[i]) ?
          substitutions[i] : null;
        addPersonalization(identity, sub);
      });
    }
    else {
      addPersonalization(recipient, substitutions);
    }

    //Set sender and subject
    mail.setFrom(sender);
    mail.setSubject(subject || '');
    mail.setTemplateId(templateId);

    //Reply to
    if (replyTo) {
      mail.setReplyTo(this.createEmail(replyTo));
    }

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
    if (!(mail instanceof Mail)) {
      mail = mailer.createMail(mail);
    }

    //Get JSON body
    const body = mail.toJSON();

    //Ensure personalizations are JSON as well
    if (body.personalizations) {
      body.personalizations = body.personalizations
        .map(p => {
          if (typeof p.toJSON === 'function') {
            return p.toJSON();
          }
          return p;
        });
    }

    //Build request
    const request = mailer.sg.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body,
    });

    //Return it
    return request;
  },

  /**
   * Send one or more emails
   */
  send(mails) {

    //Get promise implementation
    const Promise = mailer.Promise;

    //Load sendgrid instance on demand
    mailer.load();

    //Convert emails to array
    if (!Array.isArray(mails)) {
      mails = [mails];
    }

    //Convert to Sendgrid requests
    const promises = mails
      .map(mail => mailer.createMail(mail))
      .map(mail => mailer.createRequest(mail))
      .map(request => mailer.sg.API(request));

    //Process all
    return Promise.all(promises);
  },
};
