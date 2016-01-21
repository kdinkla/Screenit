
// Data model with a internal consistency that can be maintained after mutations.
export interface Model {
    // Clones the model (for future mutations).
    //clone(): Model;

    // Update proxy value definitions.
    //proxy();

    // Re-establish internal consistency after mutations.
    //conform();
}