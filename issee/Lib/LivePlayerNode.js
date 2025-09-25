/*
 * ILivePlayer pure interface
 * Copyright Michael Boccara, Blueturn - 2025
 */

// LivePlayerNode class
// A node in a graph of ILivePlayer instances
// It has a list of outgoing edges to other LivePlayerNode instances
// For example, when play() is called, it calls play() on its impl and on all its edges
// Takes care of avoiding edging cycles
class LivePlayerNode extends ILivePlayer {
    #name;
    #edges = [];
    #playing = false;
    #delaySec = 0;

    constructor(name)
    {
        super();
        this.#name = name;
    }

    addEdge(edge) {
        if (this.#edges.includes(edge))
        {
            console.warn("LivePlayerNode: edge already exists");
            return;
        }
        if (!(edge instanceof LivePlayerNode))
            throw new Error("LivePlayerNode: invalid edge");

        this.#edges.push(edge);
        edge.#edges.push(this);
    }

    setPlayState(playing) {
        if (this.#playing == playing)
            return false;
        console.log(this.#name + ": playing=" + playing);
        this.#playing = playing;
        for (let edge of this.#edges) {
            edge.setPlayState(playing);
        }
        return true;
    }

    setDelay(delaySec) {
        if (this.#delaySec == delaySec)
            return false;
        console.log(this.#name + ": delay=" + delaySec + " s");
        this.#delaySec = delaySec;
        for (let edge of this.#edges) {
            edge.setDelay(delaySec);
        }
        return true;
    }
}
