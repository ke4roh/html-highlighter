// FIXME: refactor camel-case symbols
import $ from 'jquery';

import { Css } from '../consts';
/* eslint-disable camelcase */
import { is_$, is_obj_empty } from '../util';
/* eslint-disable camelcase */

import TemplateFinder from './templatefinder';
import NodeFinder from './nodefinder';

/**
 * Class responsible for updating the user interface widget, if one is supplied
 * */
class Ui {
  /**
   * Class constructor
   *
   * @param {Main} owner - reference to owning <code>Main</code> instance
   * @param {Object} options - map containing options
   */
  constructor(owner, options) {
    this.owner = owner;

    if (!is_$(options.widget)) {
      Object.defineProperty(this, 'options', { value: false });
      return;
    }

    Object.defineProperty(this, 'options', { value: options });

    let finder = new NodeFinder('data-hh-scope', '', options.widget);

    this.root = finder.root;
    this.nodes = {
      statsCurrent: finder.find('stats-current'),
      statsTotal: finder.find('stats-total'),
      next: finder.find('button-next'),
      prev: finder.find('button-prev'),
      expander: finder.find('expand'),
      entities: finder.find('entities'),
    };

    finder = new TemplateFinder('text/hh-template', 'data-hh-scope');
    this.templates = {
      entityRow: finder.find('entity-row'),
      entityEmpty: finder.find('entity-empty'),
    };

    this.timeouts = {};

    this.nodes.expander.click(() => {
      let el = this.nodes.entities;
      el.toggleClass(Css.enabled);

      if ('entities' in this.timeouts) {
        window.clearTimeout(this.timeouts.entities);
        this.timeouts.entities = null;
      }

      if (el.hasClass(Css.enabled)) {
        this.timeouts.entities = window.setTimeout(() => {
          el.css('overflow-y', 'auto');
          this.timeouts.entities = null;
        }, this.options.delays.toggleEntities);

        this.nodes.expander.addClass(Css.enabled);
      } else {
        el.css('overflow-y', 'hidden');
        this.nodes.expander.removeClass(Css.enabled);
      }
    });

    this.nodes.entities.click(ev => {
      const $node = $(ev.target);
      if ($node.data('hh-scope') === 'remove') {
        this.owner.remove(this.getName_($node)).apply();
      }
    });

    this.nodes.next.click(() => this.owner.next());
    this.nodes.prev.click(() => this.owner.prev());

    // Initial empty state
    this.setEmpty_();
    this.update();

    // console.info("HTML highlighter UI instantiated");
  }

  /**
   * Update the UI state
   *
   * Does a full or partial update of the UI state.  A full update is done if `full` is either
   * unspecified (`undefined`) or `true`, and consists of refreshing the query set list as well as
   * the cursor position and total.  A partial update merely refreshes the cursor position and
   * total.
   *
   * @param {boolean} full - specifies whether to do a full update
   */
  update(full) {
    if (!this.options) {
      return;
    }

    this.nodes.statsCurrent.html(this.owner.cursor.index >= 0 ? this.owner.cursor.index + 1 : '-');
    this.nodes.statsTotal.html(this.owner.cursor.total);

    if (full === false || this.templates.entityRow === null) {
      return;
    } else if (is_obj_empty(this.owner.queries)) {
      this.setEmpty_();
      return;
    }

    // Template `entity-row´ must supply an LI element skeleton
    let $elu = $('<ul/>');

    Object.keys(this.owner.queries).forEach(k => {
      const q = this.owner.queries[k];
      let $eli = this.templates.entityRow.clone();

      if (q.enabled) {
        $eli.find('enable').prop('checked', true);
      }

      $eli.find('name').text(k);
      $eli.find('count').text(q.length);
      $elu.append($eli.get());
    });

    $elu.click(ev => {
      const $node = $(ev.target);
      if ($node.data('hh-scope') === 'enable') {
        if ($node.prop('checked')) {
          this.owner.enable(this.getName_($node));
        } else {
          this.owner.disable(this.getName_($node));
        }
      }
    });

    this.nodes.entities.children().remove();
    this.nodes.entities.append($elu);
  }

  getName_($node) {
    return $node
      .parentsUntil('ul')
      .last()
      .find('[data-hh-scope="name"]')
      .text();
  }

  setEmpty_() {
    this.nodes.entities.children().remove();
    if (this.templates.entityEmpty !== null) {
      this.nodes.entities.append(this.templates.entityEmpty.clone().get());
    }
  }
}

export default Ui;
