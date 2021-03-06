import React from 'react';
import PropTypes from 'prop-types';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { push as navigateTo } from 'react-router-redux';
import throttle from 'react-throttle-render';

import {
  select as d3select,
  event as d3event,
} from 'd3-selection';
import {
  forceSimulation as d3forceSimulation,
  forceCenter as d3forceCenter,
  forceManyBody as d3forceManyBody,
  forceCollide as d3forceCollide,
  forceLink as d3forceLink,
} from 'd3-force';
import {
  drag as d3drag,
} from 'd3-drag';
import {
  zoom as d3zoom,
} from 'd3-zoom';

import {
  PREFIX,
  UI_THROTTLE,
  rbacGet,
  tabOpen,
} from 'modules/k8s';

import {
  selectGraphData,
} from './selectors';
import css from './index.css';


@connect(
  (state, props) => selectGraphData(state[PREFIX], props),
  dispatch => bindActionCreators({
    navigateTo,
    rbacGet,
    tabOpen,
  }, dispatch),
)

@throttle(UI_THROTTLE)

export default class Graph extends React.Component {

  static propTypes = {

    // props
    showIsolated: PropTypes.bool.isRequired,
    showNames: PropTypes.bool.isRequired,

    // connect
    nodes: PropTypes.array.isRequired,
    links: PropTypes.array.isRequired,
    navigateTo: PropTypes.func.isRequired,
    rbacGet: PropTypes.func.isRequired,
    tabOpen: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = { container: null };
    this.d3state = null; // no need fo rerender
  }

  componentDidMount() {
    this.props.rbacGet();
  }

  componentDidUpdate() {
    this.d3Create();
    this.d3Update();
  }

  getContainer = container => {
    this.setState({ container });
  };

  d3Create = () => {
    const { container } = this.state;

    // create state
    const d3state = this.d3state = {};

    // get svg
    const svg = d3select(container);
    svg.selectAll('*').remove();

    // get dimensions
    const { width, height } = svg.node().getBoundingClientRect();
    const center = { x: width / 2, y: height / 2 };

    // create groups
    const canvas = svg.append('g');
    d3state.linksGroup = canvas.append('g');
    d3state.nodesGroup = canvas.append('g');

    // force
    const simulation = d3state.simulation = d3forceSimulation()
      .force('center', d3forceCenter(center.x, center.y))
      .force('manybody', d3forceManyBody().strength(100 /* def -30 */))
      .force('collide', d3forceCollide(50 /* r */).strength(0.2 /* def 0.7 */))
      .force('link', d3forceLink())
      .velocityDecay(0.5);

    // drag
    d3state.drag = d3drag()
      .on('start', node => {
        if (!d3event.active) simulation.alphaTarget(0.1).restart();
      })
      .on('drag', node => {
        node.fx = d3event.x;
        node.fy = d3event.y;
      })
      .on('end', node => {
        if (!d3event.active) simulation.alphaTarget(0);
        delete node.fx;
        delete node.fy;
      });

    // zoom
    const zoom = d3zoom()
      .scaleExtent([0.2, 2])
      .on('zoom', () => canvas.attr('transform', d3event.transform));
    svg.call(zoom);
  };

  d3Update = () => {
    const {
      props: {
        nodes,
        links,
      },
      d3state: {
        linksGroup,
        nodesGroup,
        drag,
        simulation,
      },
      itemEdit,
      linkFullname,
      linkShortname,
    } = this;

    let nodesSelection;
    let linksSelection;

    linksSelection = linksGroup
      .selectAll(`.${css.link}`)
      .data(links, link => link.id)
      .enter()
      .append('g')
      .attr('class', link => `${css.link} ${link.kind}`)
      .on('click', link => itemEdit(link.uid))
      .on('mouseover', linkFullname)
      .on('mouseout', linkShortname);

    linksSelection.append('line');
    linksSelection.append('text')
      .attr('dx', 4)
      .attr('dy', 4)
      .text(link => link.shortname);

    nodesSelection = nodesGroup
      .selectAll(`.${css.node}`)
      .data(nodes, node => node.id)
      .enter()
      .append('g')
      .attr('class', node => `${css.node} ${node.kind}`)
      .on('click', node => node.uid && itemEdit(node.uid))
      .call(drag);

    nodesSelection.append('circle')
      .attr('r', 7);

    nodesSelection.append('text')
      .attr('dx', 10)
      .attr('dy', 4)
      .text(node => node.name);

    simulation
      .nodes(nodes)
      .on('tick', () => {
        linksSelection
          .selectAll('line')
          .attr('x1', link => link.source.x)
          .attr('y1', link => link.source.y)
          .attr('x2', link => link.target.x)
          .attr('y2', link => link.target.y);

        linksSelection
          .selectAll('text')
          .attr('x', link => (link.source.x + link.target.x) / 2)
          .attr('y', link => (link.source.y + link.target.y) / 2);

        nodesSelection
          .attr('transform', node => `translate(${node.x},${node.y})`);
      });

    simulation.force('link')
      .links(links);
  };

  itemEdit = id => {
    const { navigateTo, tabOpen } = this.props;
    navigateTo('/catalog');
    setImmediate(() => tabOpen(id));
  };

  linkFullname(link) {
    d3select(this).select('text').text(link.fullname);
  }

  linkShortname(link) {
    d3select(this).select('text').text(link.shortname);
  }

  render() {
    const { getContainer } = this;
    return (
      <div className={css.graph}>
        <svg ref={getContainer} />
      </div>
    );
  }
}
